import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { AppError, Role } from "@hireheaven/shared";
import { env } from "../config/env.js";
import { z } from "zod";

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: {
        userId: number;
        role: string;
      };
    }
  }
}

const isAuth: RequestHandler = (req, _res, next) => {
  const suppliedKey = req.get("x-gateway-key");
  if (!suppliedKey) {
    next(new AppError(401, "Authentication required"));
    return;
  }
  const expected = Buffer.from(env.GATEWAY_INTERNAL_KEY);
  const actual = Buffer.from(suppliedKey);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    next(new AppError(401, "Authentication required"));
    return;
  }

  const identity = z.object({
    userId: z.coerce.number().int().positive().safe(),
    role: z.nativeEnum(Role),
  }).safeParse({
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

export default isAuth;
