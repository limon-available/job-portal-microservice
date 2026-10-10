import "dotenv/config";
import type { Server } from "node:http";
import { v2 as cloudinary } from "cloudinary";
import { createLogger, shutdownTelemetry, startTelemetry } from "@hireheaven/shared";
import app from "./app.js";

const logger = createLogger();
if (!process.env.INTERNAL_API_KEY) {
  throw new Error("INTERNAL_API_KEY is required");
}
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  throw new Error("Cloudinary credentials are required");
}
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const port = Number(process.env.PORT ?? 5001);
let server: Server | undefined;
let closing: Promise<void> | undefined;

const shutdown = (): Promise<void> => {
  if (!closing) {
    closing = (async () => {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server?.close((error) => error ? reject(error) : resolve());
        });
      }
      await shutdownTelemetry();
    })();
  }
  return closing;
};

process.once("SIGINT", () => {
  void shutdown().catch((error: unknown) => {
    logger.fatal({ err: error }, "graceful shutdown failed");
    process.exitCode = 1;
  });
});
process.once("SIGTERM", () => {
  void shutdown().catch((error: unknown) => {
    logger.fatal({ err: error }, "graceful shutdown failed");
    process.exitCode = 1;
  });
});

const start = async (): Promise<void> => {
  await startTelemetry("utils");
  server = app.listen(port, () => {
    logger.info({ port }, "utils service is listening");
  });
};

void start().catch(async (error: unknown) => {
  logger.fatal({ err: error }, "failed to start utils service");
  await shutdown();
  process.exitCode = 1;
});
