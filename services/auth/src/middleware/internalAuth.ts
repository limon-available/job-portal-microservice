import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { AppError } from "@hireheaven/shared";
import { env } from "../config/env.js";

export const internalAuth: RequestHandler = (req, _res, next) => {
  const key = req.get("x-internal-key");
  const expected = Buffer.from(env.INTERNAL_API_KEY);
  const provided = Buffer.from(key ?? "");
  if (!key || expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    next(new AppError(401, "Internal authentication required"));
    return;
  }
  next();
};
