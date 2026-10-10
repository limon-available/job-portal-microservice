import type { ErrorRequestHandler } from "express";
import express from "express";
import { AppError, createLogger, createObservability } from "@hireheaven/shared";
import routes from "./routes.js";

const logger = createLogger();
const app = express();
const observability = createObservability("notification");
app.use(observability.middleware);
app.get("/metrics", observability.metricsHandler);
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Notification service is healthy",
    data: { status: "ok" },
  });
});
app.use("/notifications", routes);

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const appError = error instanceof AppError ? error : undefined;
  const statusCode = appError?.statusCode ?? 500;
  const message = appError?.isOperational
    ? appError.message
    : "Internal server error";
  logger.error({ err: error }, "notification request failed");
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === "production" && !appError?.isOperational
      ? "Internal server error"
      : message,
    data: null,
  });
};
app.use(errorHandler);

export default app;
