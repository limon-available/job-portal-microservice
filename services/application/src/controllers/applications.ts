import type { RequestHandler } from "express";
import { AppError } from "@hireheaven/shared";
import { z } from "zod";
import * as applicationService from "../services/application.js";
import { TryCatch } from "../utils/TryCatch.js";
import {
  applicationIdSchema,
  applySchema,
  applyWithJobIdSchema,
  bulkStatusSchema,
  jobIdSchema,
  listApplicationsSchema,
  recruiterStatusSchema,
  reviewSchema,
} from "../validators/application.js";

const currentUserId = (req: Parameters<RequestHandler>[0]): number => {
  const userId = req.authenticatedUser?.userId;
  if (!userId) throw new AppError(401, "Authentication required");
  return userId;
};

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, "Invalid request data");
  return result.data;
};

export const applyWithJobId: RequestHandler = TryCatch(async (req, res) => {
  const body = parse(applyWithJobIdSchema, req.body);
  const application = await applicationService.applyToJob(
    body.jobId,
    currentUserId(req),
    body,
  );
  res.status(201).json({
    success: true,
    message: "Application submitted",
    data: { application },
  });
});

export const applyToPathJob: RequestHandler = TryCatch(async (req, res) => {
  const jobId = parse(jobIdSchema, req.params.jobId);
  const application = await applicationService.applyToJob(
    jobId,
    currentUserId(req),
    parse(applySchema, req.body),
  );
  res.status(201).json({
    success: true,
    message: "Application submitted",
    data: { application },
  });
});

export const getMine: RequestHandler = TryCatch(async (req, res) => {
  const applications = await applicationService.listMyApplications(currentUserId(req));
  res.json({ success: true, message: "Your applications", data: { applications } });
});

export const withdraw: RequestHandler = TryCatch(async (req, res) => {
  const application = await applicationService.withdrawApplication(
    parse(applicationIdSchema, req.params.id),
    currentUserId(req),
  );
  res.json({ success: true, message: "Application withdrawn", data: { application } });
});

export const getForJob: RequestHandler = TryCatch(async (req, res) => {
  const query = parse(listApplicationsSchema, req.query);
  const { applications, total } = await applicationService.listJobApplications(
    parse(jobIdSchema, req.params.jobId),
    currentUserId(req),
    query.status,
    query.limit,
    (query.page - 1) * query.limit,
  );
  res.json({
    success: true,
    message: "Job applications",
    data: {
      applications,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    },
  });
});

export const patchStatus: RequestHandler = TryCatch(async (req, res) => {
  const { status, ...review } = parse(recruiterStatusSchema, req.body);
  const application = await applicationService.updateApplicationStatus(
    parse(applicationIdSchema, req.params.id),
    currentUserId(req),
    status,
    review,
  );
  res.json({ success: true, message: "Application status updated", data: { application } });
});

export const patchBulkStatus: RequestHandler = TryCatch(async (req, res) => {
  const { applicationIds, status, ...review } = parse(bulkStatusSchema, req.body);
  const applications = await applicationService.updateApplicationsStatus(
    applicationIds,
    currentUserId(req),
    status,
    review,
  );
  res.json({ success: true, message: "Application statuses updated", data: { applications } });
});

export const patchReview: RequestHandler = TryCatch(async (req, res) => {
  const application = await applicationService.reviewApplication(
    parse(applicationIdSchema, req.params.id),
    currentUserId(req),
    parse(reviewSchema, req.body),
  );
  res.json({ success: true, message: "Application review updated", data: { application } });
});
