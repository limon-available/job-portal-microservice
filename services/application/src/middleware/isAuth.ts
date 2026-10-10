import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { AppError, Role } from "@hireheaven/shared";
import { z } from "zod";
import { env } from "../config/env.js";

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: {
        userId: number;
        role: Role;
      };
    }
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

export const requireRole = (...roles: Role[]): RequestHandler => (req, _res, next) => {
  if (!req.authenticatedUser || !roles.includes(req.authenticatedUser.role)) {
    next(new AppError(403, "Insufficient role"));
    return;
  }
  next();
};
