import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const dateValue = z.iso.date().optional().nullable();

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  phone: z.string().trim().min(1).max(32),
  bio: z.string().trim().max(5000),
});

export const skillSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const educationFields = z.object({
  institution: z.string().trim().min(1).max(255),
  degree: z.string().trim().min(1).max(255),
  fieldOfStudy: optionalText(255),
  startDate: dateValue,
  endDate: dateValue,
  description: optionalText(5000),
});

const validDateRange = (entry: {
  startDate?: string | null;
  endDate?: string | null;
}) => !entry.startDate || !entry.endDate || entry.startDate <= entry.endDate;

export const educationCreateSchema = educationFields.refine(validDateRange, {
  message: "endDate must not be before startDate",
  path: ["endDate"],
});

export const educationUpdateSchema = educationFields.partial()
  .refine((entry) => Object.keys(entry).length > 0, "At least one field is required")
  .refine(validDateRange, {
    message: "endDate must not be before startDate",
    path: ["endDate"],
  });

const experienceFields = z.object({
  company: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  location: optionalText(255),
  startDate: dateValue,
  endDate: dateValue,
  description: optionalText(5000),
});

export const experienceCreateSchema = experienceFields.refine(validDateRange, {
  message: "endDate must not be before startDate",
  path: ["endDate"],
});

export const experienceUpdateSchema = experienceFields.partial()
  .refine((entry) => Object.keys(entry).length > 0, "At least one field is required")
  .refine(validDateRange, {
    message: "endDate must not be before startDate",
    path: ["endDate"],
  });

export const idSchema = z.coerce.number().int().positive().safe();
export const publicUserIdSchema = z.coerce.number().int().positive().safe();
export const savedJobSchema = z.object({
  jobId: z.string().trim().min(1).max(200),
});
