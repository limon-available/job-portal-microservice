import type { RequestHandler } from "express";
import { AppError, type Role } from "@hireheaven/shared";

export const requireRole = (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new AppError(401, "Authentication required"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Insufficient permissions"));
    }
    return next();
  };
