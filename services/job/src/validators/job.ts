import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const positiveId = z.coerce.number().int().positive().safe();
const date = z.iso.date().nullable().optional();

export const companySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10000).default(""),
  website: z.string().trim().url().max(2048).optional().nullable(),
  location: optionalText(255),
});

export const companyPatchSchema = companySchema.partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const jobSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(30000),
  location: z.string().trim().min(1).max(255),
  jobType: z.enum(["full-time", "part-time", "contract", "internship", "temporary", "remote"]),
  salaryMin: z.number().int().nonnegative().nullable().optional(),
  salaryMax: z.number().int().nonnegative().nullable().optional(),
  experienceYears: z.number().int().min(0).max(60).default(0),
  deadline: date,
  status: z.enum(["draft", "open", "closed"]).default("draft"),
  companyId: positiveId,
  skills: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
}).refine((job) =>
  job.salaryMin == null || job.salaryMax == null || job.salaryMin <= job.salaryMax, {
  message: "salaryMin must not exceed salaryMax",
  path: ["salaryMax"],
});

export const jobPatchSchema = jobSchema.partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")
  .refine((job) =>
    job.salaryMin == null || job.salaryMax == null || job.salaryMin <= job.salaryMax, {
    message: "salaryMin must not exceed salaryMax",
    path: ["salaryMax"],
  });

export const jobStatusSchema = z.object({
  status: z.enum(["draft", "open", "closed", "expired"]),
});

export const jobIdSchema = positiveId;
export const jobSearchSchema = z.object({
  keyword: z.string().trim().max(200).optional(),
  location: z.string().trim().max(255).optional(),
  jobType: z.enum(["full-time", "part-time", "contract", "internship", "temporary", "remote"]).optional(),
  salaryMin: z.coerce.number().int().nonnegative().optional(),
  salaryMax: z.coerce.number().int().nonnegative().optional(),
  skills: z.union([z.string(), z.array(z.string())]).optional(),
  sort: z.enum(["newest", "oldest", "salary_asc", "salary_desc"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).refine((query) =>
  query.salaryMin === undefined || query.salaryMax === undefined || query.salaryMin <= query.salaryMax, {
  message: "salaryMin must not exceed salaryMax",
  path: ["salaryMax"],
});

export const idSchema = positiveId;
