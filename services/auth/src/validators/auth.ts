import { z } from "zod";
import { Role } from "@hireheaven/shared";

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: emailSchema,
  password: passwordSchema,
  phoneNumber: z.string().trim().min(1).max(20),
  role: z.enum([Role.Jobseeker, Role.Recruiter]),
  bio: z.string().trim().min(1).max(5000),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const forgotSchema = z.object({
  email: emailSchema,
});

export const resetParamsSchema = z.object({
  token: z.string().min(1),
});

export const resetSchema = z.object({
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  password: passwordSchema,
});

export const verifyEmailParamsSchema = z.object({
  token: z.string().min(1),
});
