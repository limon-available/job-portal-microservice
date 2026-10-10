import "dotenv/config";
import type { Server } from "node:http";
import { createLogger, shutdownTelemetry, startTelemetry } from "@hireheaven/shared";
import app from "./app.js";
import { env } from "./config/env.js";

const logger = createLogger({ level: env.LOG_LEVEL });
let server: Server | undefined;
let shutdownPromise: Promise<void> | undefined;

const shutdown = (signal: string): Promise<void> => {
  if (!shutdownPromise) {
    shutdownPromise = (async () => {
      logger.info({ signal }, "shutting down user service");
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server?.close((error) => error ? reject(error) : resolve());
        });
      }
      await shutdownTelemetry();
    })();
  }
  return shutdownPromise;
};

process.once("SIGINT", () => {
  void shutdown("SIGINT").catch((error: unknown) => {
    logger.fatal({ err: error }, "graceful shutdown failed");
    process.exitCode = 1;
  });
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM").catch((error: unknown) => {
    logger.fatal({ err: error }, "graceful shutdown failed");
    process.exitCode = 1;
  });
});

const start = async (): Promise<void> => {
  await startTelemetry("user");
  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "user service is listening");
  });
};

void start().catch(async (error: unknown) => {
  logger.fatal({ err: error }, "failed to start user service");
  await shutdown("startup failure");
  process.exitCode = 1;
});
