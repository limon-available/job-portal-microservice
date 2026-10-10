import type { ErrorRequestHandler } from "express";
import { AppError, createLogger } from "@hireheaven/shared";
import { env } from "../config/env.js";

const logger = createLogger({ level: env.LOG_LEVEL });

const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const appError = error instanceof AppError ? error : null;
  const candidateStatusCode = typeof error === "object" && error !== null
    ? "code" in error && error.code === "LIMIT_FILE_SIZE"
      ? 413
      : "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : "status" in error && typeof error.status === "number"
          ? error.status
          : 500
    : 500;
  const statusCode = Number.isInteger(candidateStatusCode) &&
    candidateStatusCode >= 400 && candidateStatusCode <= 599
    ? candidateStatusCode
    : 500;
  const isOperationalError = appError?.isOperational === true ||
    (typeof error === "object" && error !== null &&
      "code" in error && error.code === "LIMIT_FILE_SIZE");
  const message = isOperationalError && appError
    ? appError.message
    : candidateStatusCode === 413
      ? "Request entity too large"
      : "Internal server error";

  logger.error({
    err: error,
    requestId: res.locals.requestId,
    method: req.method,
    path: req.path,
  }, "request failed");

  res.status(statusCode).json({
    success: false,
    message: env.NODE_ENV === "production" && !isOperationalError
      ? "Internal server error"
      : message,
    data: null,
  });
};

export default errorHandler;
