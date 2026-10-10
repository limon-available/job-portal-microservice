import { randomUUID } from "node:crypto";
import axios from "axios";
import { AppError, type JobCreated, type JobUpdated } from "@hireheaven/shared";
import { env } from "../config/env.js";
import * as repository from "../repositories/jobs.js";
import {
  publishJobCreated,
  publishJobDeleted,
  publishJobUpdated,
} from "./kafka.js";
import { queueJobView } from "./views.js";
import type { CompanyInput, CompanyPatch, JobInput, JobPatch } from "./types.js";

const companyOwnerId = (company: { owner_id: number }): number => Number(company.owner_id);

export const listCompanies = (userId: number) => repository.listCompanies(userId);

export const createCompany = (userId: number, data: CompanyInput) =>
  repository.createCompany(userId, data);

export const updateCompany = async (
  userId: number,
  companyId: number,
  data: CompanyPatch,
) => {
  const existing = await repository.findCompany(companyId);
  if (!existing || companyOwnerId(existing) !== userId) throw new AppError(404, "Company not found");
  return repository.updateCompany(userId, companyId, data);
};

export const deleteCompany = async (userId: number, companyId: number) => {
  const existing = await repository.findCompany(companyId);
  if (!existing || companyOwnerId(existing) !== userId) throw new AppError(404, "Company not found");
  if (await repository.companyHasJobs(companyId)) {
    throw new AppError(409, "Delete or reassign the company's jobs before deleting it");
  }
  const deleted = await repository.deleteCompany(userId, companyId);
  if (!deleted[0]) throw new AppError(409, "Company could not be deleted");
  if (deleted[0].logo_public_id) {
    await axios.delete(
      `${env.UPLOAD_SERVICE}/api/utils/upload/${encodeURIComponent(String(deleted[0].logo_public_id))}`,
      {
        params: { folder: "logos" },
        headers: { "x-internal-key": env.INTERNAL_API_KEY },
      },
    );
  }
};

export const uploadCompanyLogo = async (
  userId: number,
  companyId: number,
  file: Express.Multer.File,
) => {
  const company = await repository.findCompany(companyId);
  if (!company || companyOwnerId(company) !== userId) throw new AppError(404, "Company not found");
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
  body.append("folder", "logos");
  const response = await axios.post<{
    data: { url: string; public_id: string };
  }>(`${env.UPLOAD_SERVICE}/api/utils/upload`, body, {
    headers: { "x-internal-key": env.INTERNAL_API_KEY },
  });
  const uploaded = response.data.data;
  if (!uploaded?.url || !uploaded.public_id) {
    throw new AppError(502, "Upload service returned an invalid response", false);
  }
  const updated = await repository.updateCompanyLogo(userId, companyId, uploaded.url, uploaded.public_id);
  if (!updated) throw new AppError(404, "Company not found");
  if (company.logo_public_id) {
    await axios.delete(
      `${env.UPLOAD_SERVICE}/api/utils/upload/${encodeURIComponent(String(company.logo_public_id))}`,
      {
        params: { folder: "logos" },
        headers: { "x-internal-key": env.INTERNAL_API_KEY },
      },
    );
  }
  return updated;
};

const toJobCreated = async (job: Record<string, unknown>): Promise<JobCreated> => {
  const skills = await repository.listJobSkills(Number(job.job_id));
  return {
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    jobId: String(job.job_id),
    recruiterId: Number(job.posted_by),
    companyId: Number(job.company_id),
    companyName: String(job.company_name ?? ""),
    title: String(job.title),
    description: String(job.description),
    location: String(job.location),
    jobType: String(job.job_type),
    salaryMin: job.salary_min == null ? null : Number(job.salary_min),
    salaryMax: job.salary_max == null ? null : Number(job.salary_max),
    skills,
    deadline: job.deadline == null ? null : String(job.deadline),
  };
};

export const createJob = async (userId: number, data: JobInput) => {
  const company = await repository.findCompany(data.companyId);
  if (!company || companyOwnerId(company) !== userId) throw new AppError(404, "Company not found");
  if (data.status === "open" && data.deadline &&
    data.deadline < new Date().toISOString().slice(0, 10)) {
    throw new AppError(400, "An open job cannot have a past deadline");
  }
  const created = await repository.createJob(userId, data, randomUUID().slice(0, 8));
  if (!created) throw new AppError(400, "Job could not be created");
  await publishJobCreated(await toJobCreated({
    ...created,
    company_name: company.name,
  }));
  return created;
};

export const updateJob = async (userId: number, jobId: number, data: JobPatch) => {
  const existing = await repository.findOwnedJob(userId, jobId);
  if (!existing) throw new AppError(404, "Job not found");
  const salaryMin = data.salaryMin === undefined ? existing.salary_min : data.salaryMin;
  const salaryMax = data.salaryMax === undefined ? existing.salary_max : data.salaryMax;
  if (salaryMin != null && salaryMax != null && Number(salaryMin) > Number(salaryMax)) {
    throw new AppError(400, "salaryMin must not exceed salaryMax");
  }
  const nextStatus = data.status ?? String(existing.status);
  const nextDeadline = data.deadline === undefined ? existing.deadline : data.deadline;
  if (nextStatus === "open" && nextDeadline &&
    String(nextDeadline) < new Date().toISOString().slice(0, 10)) {
    throw new AppError(400, "An open job cannot have a past deadline");
  }
  if (data.companyId !== undefined) {
    const company = await repository.findCompany(data.companyId);
    if (!company || companyOwnerId(company) !== userId) throw new AppError(404, "Company not found");
  }
  const updated = await repository.updateJob(userId, jobId, data);
  if (!updated) throw new AppError(404, "Job not found");
  await publishJobUpdated({
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    jobId: String(jobId),
    recruiterId: userId,
    companyId: Number(updated.company_id),
    title: String(updated.title),
    status: String(updated.status),
    changes: data,
  });
  return updated;
};

export const updateJobStatus = async (
  userId: number,
  jobId: number,
  status: "draft" | "open" | "closed" | "expired",
) => {
  const existing = await repository.findOwnedJob(userId, jobId);
  if (!existing) throw new AppError(404, "Job not found");
  if (status === "open" && existing.deadline &&
    String(existing.deadline) < new Date().toISOString().slice(0, 10)) {
    throw new AppError(400, "An expired job cannot be reopened");
  }
  const updated = await repository.updateJobStatus(userId, jobId, status);
  if (!updated) throw new AppError(404, "Job not found");
  await publishJobUpdated({
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    jobId: String(jobId),
    recruiterId: userId,
    companyId: Number(updated.company_id),
    title: String(updated.title),
    status: String(updated.status),
    changes: { status },
  });
  return updated;
};

export const deleteJob = async (userId: number, jobId: number): Promise<void> => {
  const [deleted] = await repository.deleteJob(userId, jobId);
  if (!deleted) throw new AppError(404, "Job not found");
  await publishJobDeleted({
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    jobId: String(jobId),
    recruiterId: userId,
    companyId: Number(deleted.company_id),
    title: String(deleted.title),
  });
};

export const listMyJobs = (userId: number) => repository.listMyJobs(userId);

export const searchJobs = async (filters: repository.SearchFilters) => {
  const normalizedFilters = {
    ...filters,
    skills: filters.skills.map((skill) => skill.trim().toLowerCase()),
  };
  return repository.searchJobs(normalizedFilters);
};

export const getPublicJob = async (idOrSlug: string) => {
  const job = await repository.findJob(idOrSlug);
  if (!job || job.status !== "open" ||
    (job.deadline && String(job.deadline) < new Date().toISOString().slice(0, 10))) {
    throw new AppError(404, "Job not found");
  }
  const skills = await repository.listJobSkills(Number(job.job_id));
  await queueJobView(Number(job.job_id));
  return { ...job, skills, views: Number(job.views) + 1 };
};

export const getInternalJob = async (jobId: number) => {
  const job = await repository.findJob(String(jobId));
  if (!job) throw new AppError(404, "Job not found");
  return job;
};

export const expireJobs = async (): Promise<void> => {
  await repository.expireJobsAndQueueEvents();
  while (true) {
    const pending = await repository.pendingExpiryEvents();
    if (pending.length === 0) return;
    for (const event of pending) {
      await publishJobUpdated(event.payload as JobUpdated);
      await repository.markExpiryEventPublished(String(event.event_id));
    }
  }
};
