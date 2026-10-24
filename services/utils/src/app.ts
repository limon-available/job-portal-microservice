import type { ErrorRequestHandler } from "express";
import express from "express";
import cors from "cors";
import multer from "multer";
import { AppError, createLogger, createObservability } from "@hireheaven/shared";
import routes from "./routes.js";

const logger = createLogger();
const app = express();
const observability = createObservability("utils");

app.use(observability.middleware);
app.get("/metrics", observability.metricsHandler);
app.get("/health", (_req, res) => {
  res.json({ success: true, message: "Utils service is healthy", data: { status: "ok" } });
});
app.use(express.json({ limit: "5mb" }));
app.use(cors());
app.use(express.urlencoded({ limit: "5mb", extended: true }));
app.use("/api/utils", routes);

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const multerError = error instanceof multer.MulterError ? error : undefined;
  const isUploadTooLarge = multerError?.code === "LIMIT_FILE_SIZE";
  const appError = error instanceof AppError ? error : undefined;
  const statusCode = isUploadTooLarge ? 413 : multerError ? 400 : (appError?.statusCode ?? 500);
  const isOperational = appError?.isOperational === true || Boolean(multerError);
  const message = isUploadTooLarge
    ? "File exceeds the 5MB upload limit"
    : multerError
      ? "Invalid multipart upload"
      : appError?.isOperational
        ? appError.message
        : "Internal server error";

  logger.error({ err: error }, "utils request failed");
  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === "production" && !isOperational ? "Internal server error" : message,
    data: null,
  });
};
app.use(errorHandler);

export default app;
