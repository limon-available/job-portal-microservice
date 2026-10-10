import "dotenv/config";
import type { Server } from "node:http";
import { createClient } from "redis";
import { createLogger, shutdownTelemetry, startTelemetry } from "@hireheaven/shared";
import app from "./app.js";
import { env } from "./config/env.js";
import { connectKafka, disconnectKafka } from "./services/kafka.js";
import { startConsumers } from "./services/consumers.js";

const logger = createLogger({ level: env.LOG_LEVEL });
const redis = createClient({ url: env.REDIS_URL });
let consumers: Awaited<ReturnType<typeof startConsumers>> = [];
let server: Server | undefined;
let shutdownPromise: Promise<void> | undefined;

const shutdown = (signal: string): Promise<void> => {
  if (!shutdownPromise) {
    shutdownPromise = (async () => {
      logger.info({ signal }, "shutting down application service");
      const errors: unknown[] = [];
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server?.close((error) => error ? reject(error) : resolve());
        }).catch((error: unknown) => errors.push(error));
      }
      await Promise.all(consumers.map((consumer) =>
        consumer.stop().catch((error: unknown) => errors.push(error)),
      ));
      await disconnectKafka().catch((error: unknown) => errors.push(error));
      if (redis.isOpen) {
        await redis.quit().catch((error: unknown) => errors.push(error));
      }
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
  await startTelemetry("application");
  await redis.connect();
  await connectKafka();
  consumers = await startConsumers(redis);
  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "application service is listening");
  });
};

void start().catch(async (error: unknown) => {
  logger.fatal({ err: error }, "failed to start application service");
  await shutdown("startup failure");
  process.exitCode = 1;
});
