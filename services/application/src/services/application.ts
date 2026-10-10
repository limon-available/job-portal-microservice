import { randomUUID } from "node:crypto";
import { AppError } from "@hireheaven/shared";
import * as repository from "../repositories/applications.js";
import type {
  ApplicationReview,
  ApplicationStatus,
  ApplyInput,
  RecruiterStatus,
} from "../validators/application.js";
import { applicationStatusSchema, stateTransitions } from "../validators/application.js";
import { publishApplicationStatusChanged, publishApplicationSubmitted } from "./kafka.js";
import { getUserIdentity } from "./identityClient.js";
import { getJob } from "./jobClient.js";

const statusOf = (value: unknown): ApplicationStatus => {
  const result = applicationStatusSchema.safeParse(value);
  if (!result.success) throw new AppError(500, "Application has an invalid stored status", false);
  return result.data;
};

const assertJobOpen = (job: Awaited<ReturnType<typeof getJob>>): void => {
  if (
    job.status !== "open" ||
    (job.deadline && job.deadline < new Date().toISOString().slice(0, 10))
  ) {
    throw new AppError(409, "Job is not accepting applications");
  }
};

const assertRecruiterOwnsJob = async (jobId: number, recruiterId: number) => {
  const job = await getJob(jobId);
  if (Number(job.posted_by) !== recruiterId) {
    throw new AppError(404, "Job not found");
  }
  return job;
};

const canTransition = (from: ApplicationStatus, to: ApplicationStatus): boolean =>
  stateTransitions[from].includes(to);

const transitionApplication = async (
  application: Record<string, unknown>,
  recruiterId: number,
  status: RecruiterStatus,
  review: ApplicationReview,
) => {
  const jobId = Number(application.job_id);
  const fromStatus = statusOf(application.status);
  if (!canTransition(fromStatus, status)) {
    throw new AppError(409, `Application cannot transition from ${fromStatus} to ${status}`);
  }
  const [job, applicant] = await Promise.all([
    assertRecruiterOwnsJob(jobId, recruiterId),
    getUserIdentity(Number(application.user_id)),
  ]);
  const updated = await repository.updateStatus(
    Number(application.application_id),
    fromStatus,
    status,
    recruiterId,
    review,
  );
  if (!updated) {
    throw new AppError(409, "Application status changed; reload and try again");
  }
  await publishApplicationStatusChanged({
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    applicationId: String(updated.application_id),
    jobId: String(updated.job_id),
    applicantId: Number(updated.user_id),
    applicantName: applicant.name,
    applicantEmail: applicant.email,
    jobTitle: job.title,
    previousStatus: fromStatus,
    status,
  });
  return updated;
};

export const applyToJob = async (
  jobId: number,
  userId: number,
  input: ApplyInput,
) => {
  const job = await getJob(jobId);
  assertJobOpen(job);
  const [applicant, recruiter] = await Promise.all([
    getUserIdentity(userId),
    getUserIdentity(Number(job.posted_by)),
  ]);
  let application: Record<string, unknown> | undefined;
  try {
    application = await repository.createApplication({
      jobId,
      userId,
      resumeUrl: input.resumeUrl ?? null,
      coverLetter: input.coverLetter,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AppError(409, "You have already applied to this job");
    }
    throw error;
  }
  if (!application) throw new AppError(500, "Application could not be created", false);
  await publishApplicationSubmitted({
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    applicationId: String(application.application_id),
    jobId: String(application.job_id),
    applicantId: userId,
    applicantName: applicant.name,
    recruiterId: Number(job.posted_by),
    recruiterEmail: recruiter.email,
    recruiterName: recruiter.name,
    jobTitle: job.title,
  });
  return application;
};

export const listMyApplications = (userId: number) => repository.listMine(userId);

export const withdrawApplication = async (applicationId: number, userId: number) => {
  const existing = await repository.findById(applicationId);
  if (!existing || Number(existing.user_id) !== userId) {
    throw new AppError(404, "Application not found");
  }
  const fromStatus = statusOf(existing.status);
  if (!canTransition(fromStatus, "withdrawn")) {
    throw new AppError(409, `Application with ${fromStatus} status cannot be withdrawn`);
  }
  const [job, applicant] = await Promise.all([
    getJob(Number(existing.job_id)),
    getUserIdentity(userId),
  ]);
  const updated = await repository.withdraw(applicationId, userId, fromStatus);
  if (!updated) throw new AppError(409, "Application status changed; reload and try again");
  await publishApplicationStatusChanged({
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    applicationId: String(updated.application_id),
    jobId: String(updated.job_id),
    applicantId: userId,
    applicantName: applicant.name,
    applicantEmail: applicant.email,
    jobTitle: job.title,
    previousStatus: fromStatus,
    status: "withdrawn",
  });
  return updated;
};

export const listJobApplications = async (
  jobId: number,
  recruiterId: number,
  status: ApplicationStatus | undefined,
  limit: number,
  offset: number,
) => {
  await assertRecruiterOwnsJob(jobId, recruiterId);
  return repository.listForJob(jobId, status, limit, offset);
};

export const updateApplicationStatus = async (
  applicationId: number,
  recruiterId: number,
  status: RecruiterStatus,
  review: ApplicationReview,
) => {
  const application = await repository.findById(applicationId);
  if (!application) throw new AppError(404, "Application not found");
  return transitionApplication(application, recruiterId, status, review);
};

export const updateApplicationsStatus = async (
  applicationIds: number[],
  recruiterId: number,
  status: RecruiterStatus,
  review: ApplicationReview,
) => {
  const applications = await repository.findManyByIds(applicationIds);
  if (applications.length !== applicationIds.length) {
    throw new AppError(404, "One or more applications were not found");
  }
  const jobs = new Map<number, Awaited<ReturnType<typeof getJob>>>();
  for (const application of applications) {
    const jobId = Number(application.job_id);
    if (!jobs.has(jobId)) {
      jobs.set(jobId, await assertRecruiterOwnsJob(jobId, recruiterId));
    }
    const fromStatus = statusOf(application.status);
    if (!canTransition(fromStatus, status)) {
      throw new AppError(409, `Application ${application.application_id} cannot transition from ${fromStatus} to ${status}`);
    }
  }
  const updated: Array<Record<string, unknown>> = [];
  for (const application of applications) {
    updated.push(await transitionApplication(application, recruiterId, status, review));
  }
  return updated;
};

export const reviewApplication = async (
  applicationId: number,
  recruiterId: number,
  review: ApplicationReview,
) => {
  const application = await repository.findById(applicationId);
  if (!application) throw new AppError(404, "Application not found");
  await assertRecruiterOwnsJob(Number(application.job_id), recruiterId);
  const updated = await repository.updateReview(applicationId, review);
  if (!updated) throw new AppError(404, "Application not found");
  return updated;
};

export const closeApplicationsForDeletedJob = async (jobId: number): Promise<void> => {
  await repository.closeApplicationsForJob(jobId);
};
