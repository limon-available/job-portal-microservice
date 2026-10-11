import "dotenv/config";
import type { Server } from "node:http";
import cron, { type ScheduledTask } from "node-cron";
import { createLogger, shutdownTelemetry, startTelemetry } from "@hireheaven/shared";
import app from "./app.js";
import { env } from "./config/env.js";
import { connectKafka, disconnectKafka } from "./services/kafka.js";
import { connectRedis, disconnectRedis, flushJobViews } from "./services/views.js";
import { expireJobs } from "./services/job.js";

const logger = createLogger({ level: env.LOG_LEVEL });
let server: Server | undefined;
let shutdownPromise: Promise<void> | undefined;
let viewFlushTimer: NodeJS.Timeout | undefined;
let expiryTask: ScheduledTask | undefined;
let expiryRunning = false;

const shutdown = (signal: string): Promise<void> => {
  if (!shutdownPromise) {
    shutdownPromise = (async () => {
      logger.info({ signal }, "shutting down job service");
      expiryTask?.stop();
      if (viewFlushTimer) clearInterval(viewFlushTimer);
      const errors: unknown[] = [];
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server?.close((error) => (error ? reject(error) : resolve()));
        }).catch((error: unknown) => errors.push(error));
      }
      await flushJobViews().catch((error: unknown) => errors.push(error));
      await disconnectKafka().catch((error: unknown) => errors.push(error));
      await disconnectRedis().catch((error: unknown) => errors.push(error));
      await shutdownTelemetry().catch((error: unknown) => errors.push(error));
      for (const error of errors) logger.error({ err: error }, "shutdown operation failed");
      if (errors.length > 0) process.exitCode = 1;
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
  await startTelemetry("job");
  await connectRedis();
  await connectKafka();
  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "job service is listening");
  });
  viewFlushTimer = setInterval(() => {
    void flushJobViews().catch((error: unknown) => {
      logger.error({ err: error }, "periodic job view flush failed");
    });
  }, 30_000);
  expiryTask = cron.schedule("0 * * * *", () => {
    if (expiryRunning) return;
    expiryRunning = true;
    void expireJobs()
      .catch((error: unknown) => logger.error({ err: error }, "job expiry task failed"))
      .finally(() => {
        expiryRunning = false;
      });
  });
};

void start().catch(async (error: unknown) => {
  logger.fatal({ err: error }, "failed to start job service");
  await shutdown("startup failure");
  process.exitCode = 1;
});
