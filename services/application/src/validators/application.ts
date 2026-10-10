import { z } from "zod";

export const applicationIdSchema = z.coerce.number().int().positive().safe();
export const jobIdSchema = applicationIdSchema;
export const applyWithJobIdSchema = z.object({
  jobId: jobIdSchema,
  resumeUrl: z.string().url().max(2048).nullable().optional(),
  coverLetter: z.string().trim().max(5000).default(""),
});

export const applySchema = z.object({
  resumeUrl: z.string().url().max(2048).nullable().optional(),
  coverLetter: z.string().trim().max(5000).default(""),
});

export const recruiterStatusSchema = z.object({
  status: z.enum(["shortlisted", "interview", "hired", "rejected"]),
  recruiterNote: z.string().trim().max(5000).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

export const bulkStatusSchema = z.object({
  applicationIds: z.array(applicationIdSchema).min(1).max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Application IDs must be unique"),
  status: z.enum(["shortlisted", "interview", "hired", "rejected"]),
  recruiterNote: z.string().trim().max(5000).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

export const reviewSchema = z.object({
  recruiterNote: z.string().trim().max(5000).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
}).refine((review) => review.recruiterNote !== undefined || review.rating !== undefined, {
  message: "Provide a recruiter note or rating",
});

export const applicationStatusSchema = z.enum([
  "applied",
  "shortlisted",
  "interview",
  "hired",
  "rejected",
  "withdrawn",
  "closed",
]);

export const listApplicationsSchema = z.object({
  status: applicationStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export const stateTransitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  applied: ["shortlisted", "withdrawn", "closed"],
  shortlisted: ["interview", "withdrawn", "closed"],
  interview: ["hired", "rejected", "withdrawn", "closed"],
  hired: [],
  rejected: [],
  withdrawn: [],
  closed: [],
};
export type RecruiterStatus = z.infer<typeof recruiterStatusSchema>["status"];
export type ApplicationReview = z.infer<typeof reviewSchema>;
export type ApplyInput = z.infer<typeof applySchema>;
