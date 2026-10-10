import type { ErrorRequestHandler } from "express";
import express from "express";
import { AppError, createLogger, createObservability } from "@hireheaven/shared";
import routes from "./routes.js";

const logger = createLogger();
const app = express();
const observability = createObservability("user");
app.use(observability.middleware);
app.get("/metrics", observability.metricsHandler);
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_req, res) => {
  res.json({ success: true, message: "User service is healthy", data: { status: "ok" } });
});
app.use("/api/user", routes);

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const tooLarge = typeof error === "object" && error !== null &&
    "code" in error && error.code === "LIMIT_FILE_SIZE";
  const appError = error instanceof AppError ? error : undefined;
  const statusCode = tooLarge ? 413 : appError?.statusCode ?? 500;
  const message = tooLarge
    ? "File exceeds the 5MB upload limit"
    : appError?.isOperational
      ? appError.message
      : "Internal server error";
  logger.error({ err: error }, "user request failed");
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === "production" && !appError?.isOperational && !tooLarge
      ? "Internal server error"
      : message,
    data: null,
  });
};
app.use(errorHandler);

export default app;
