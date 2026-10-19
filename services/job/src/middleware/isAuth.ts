import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { AppError, Role } from "@hireheaven/shared";
import { z } from "zod";
import { env } from "../config/env.js";

declare module "express-serve-static-core" {
  interface Request {
    authenticatedUser?: {
      userId: number;
      role: Role;
    };
  }
}

const identitySchema = z.object({
  userId: z.coerce.number().int().positive().safe(),
  role: z.nativeEnum(Role),
});

export const isAuth: RequestHandler = (req, _res, next) => {
  const key = req.get("x-gateway-key");
  const expected = Buffer.from(env.GATEWAY_INTERNAL_KEY);
  const provided = Buffer.from(key ?? "");
  if (!key || expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    next(new AppError(401, "Authentication required"));
    return;
  }
  const identity = identitySchema.safeParse({
    userId: req.get("x-user-id"),
    role: req.get("x-user-role"),
  });
  if (!identity.success) {
    next(new AppError(401, "Invalid gateway identity"));
    return;
  }
  req.authenticatedUser = identity.data;
  next();
};

export const requireRecruiter: RequestHandler = (req, _res, next) => {
  if (req.authenticatedUser?.role !== Role.Recruiter) {
    next(new AppError(403, "Recruiter role required"));
    return;
  }
  next();
};

export const isInternal: RequestHandler = (req, _res, next) => {
  const key = req.get("x-internal-key");
  const expected = Buffer.from(env.INTERNAL_API_KEY);
  const provided = Buffer.from(key ?? "");
  if (!key || expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    next(new AppError(401, "Internal authentication required"));
    return;
  }
  next();
};
