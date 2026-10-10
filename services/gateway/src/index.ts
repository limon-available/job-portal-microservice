import "dotenv/config";
import type { Server } from "node:http";
import { createClient } from "redis";
import { createLogger, shutdownTelemetry, startTelemetry } from "@hireheaven/shared";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

const logger = createLogger({ level: env.LOG_LEVEL });
const redis = createClient({ url: env.REDIS_URL });
const app = createApp(redis);
let server: Server | undefined;
let shutdownPromise: Promise<void> | undefined;

const shutdown = (signal: string): Promise<void> => {
  if (!shutdownPromise) {
    shutdownPromise = (async () => {
      logger.info({ signal }, "shutting down gateway");
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server?.close((error) => error ? reject(error) : resolve());
        });
      }
      if (redis.isOpen) await redis.quit();
      await shutdownTelemetry();
    })();
  }
  return shutdownPromise;
};

process.once("SIGINT", () => {
  void shutdown("SIGINT").catch((error: unknown) => {
    logger.fatal({ err: error }, "gateway shutdown failed");
    process.exitCode = 1;
  });
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM").catch((error: unknown) => {
    logger.fatal({ err: error }, "gateway shutdown failed");
    process.exitCode = 1;
  });
});

const start = async (): Promise<void> => {
  await startTelemetry("gateway");
  await redis.connect();
  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "gateway is listening");
  });
};

void start().catch(async (error: unknown) => {
  logger.fatal({ err: error }, "failed to start gateway");
  await shutdown("startup failure");
  process.exitCode = 1;
});
