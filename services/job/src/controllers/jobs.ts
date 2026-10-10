import type { RequestHandler } from "express";
import { AppError } from "@hireheaven/shared";
import { z } from "zod";
import * as jobService from "../services/job.js";
import { TryCatch } from "../utils/TryCatch.js";
import {
  companyPatchSchema,
  companySchema,
  idSchema,
  jobPatchSchema,
  jobSchema,
  jobSearchSchema,
  jobStatusSchema,
} from "../validators/job.js";

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

export const listCompanies: RequestHandler = TryCatch(async (req, res) => {
  const companies = await jobService.listCompanies(currentUserId(req));
  res.json({ success: true, message: "Companies", data: { companies } });
});

export const postCompany: RequestHandler = TryCatch(async (req, res) => {
  const company = await jobService.createCompany(currentUserId(req), parse(companySchema, req.body));
  res.status(201).json({ success: true, message: "Company created", data: { company } });
});

export const putCompany: RequestHandler = TryCatch(async (req, res) => {
  const company = await jobService.updateCompany(
    currentUserId(req),
    parse(idSchema, req.params.id),
    parse(companyPatchSchema, req.body),
  );
  res.json({ success: true, message: "Company updated", data: { company } });
});

export const deleteCompany: RequestHandler = TryCatch(async (req, res) => {
  await jobService.deleteCompany(currentUserId(req), parse(idSchema, req.params.id));
  res.json({ success: true, message: "Company deleted", data: null });
});

export const putCompanyLogo: RequestHandler = TryCatch(async (req, res) => {
  if (!req.file) throw new AppError(400, "file is required");
  const company = await jobService.uploadCompanyLogo(
    currentUserId(req),
    parse(idSchema, req.params.id),
    req.file,
  );
  res.json({ success: true, message: "Company logo updated", data: { company } });
});

export const postJob: RequestHandler = TryCatch(async (req, res) => {
  const job = await jobService.createJob(currentUserId(req), parse(jobSchema, req.body));
  res.status(201).json({ success: true, message: "Job created", data: { job } });
});

export const putJob: RequestHandler = TryCatch(async (req, res) => {
  const job = await jobService.updateJob(
    currentUserId(req),
    parse(idSchema, req.params.id),
    parse(jobPatchSchema, req.body),
  );
  res.json({ success: true, message: "Job updated", data: { job } });
});

export const deleteJob: RequestHandler = TryCatch(async (req, res) => {
  await jobService.deleteJob(currentUserId(req), parse(idSchema, req.params.id));
  res.json({ success: true, message: "Job deleted", data: null });
});

export const patchJobStatus: RequestHandler = TryCatch(async (req, res) => {
  const { status } = parse(jobStatusSchema, req.body);
  const job = await jobService.updateJobStatus(
    currentUserId(req),
    parse(idSchema, req.params.id),
    status,
  );
  res.json({ success: true, message: "Job status updated", data: { job } });
});

export const getMyJobs: RequestHandler = TryCatch(async (req, res) => {
  const jobs = await jobService.listMyJobs(currentUserId(req));
  res.json({ success: true, message: "Your jobs", data: { jobs } });
});

export const getJobs: RequestHandler = TryCatch(async (req, res) => {
  const query = parse(jobSearchSchema, req.query);
  const requestedSkills = query.skills === undefined
    ? []
    : (Array.isArray(query.skills) ? query.skills : query.skills.split(","))
      .map((skill) => skill.trim())
      .filter(Boolean);
  const { jobs, total } = await jobService.searchJobs({
    ...query,
    skills: requestedSkills,
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  });
  res.json({
    success: true,
    message: "Jobs",
    data: {
      jobs,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    },
  });
});

export const getJob: RequestHandler = TryCatch(async (req, res) => {
  const parsed = z.string().trim().min(1).max(300).safeParse(req.params.idOrSlug);
  if (!parsed.success) throw new AppError(400, "Invalid job ID or slug");
  const idOrSlug = parsed.data;
  const job = await jobService.getPublicJob(idOrSlug);
  res.json({ success: true, message: "Job", data: { job } });
});

export const getInternalJob: RequestHandler = TryCatch(async (req, res) => {
  const job = await jobService.getInternalJob(parse(idSchema, req.params.id));
  res.json({ success: true, message: "Job", data: { job } });
});
