import type { Server } from "node:http";
import { env } from "./config/env.js";
import { connectKafka, disconnectKafka } from "./producer.js";
import { createLogger, shutdownTelemetry, startTelemetry } from "@hireheaven/shared";
import { redisClient } from "./utils/redis.js";
import { initializeAuthApp } from "./bootstrap.js";

const logger = createLogger({ level: env.LOG_LEVEL });
let server: Server | undefined;
let shutdownPromise: Promise<void> | undefined;

async function start(): Promise<void> {
  await startTelemetry("auth");
  const app = await initializeAuthApp(
    () => redisClient.connect(),
    () => import("./app.js"),
  );
  await connectKafka();
  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "auth service is listening");
  });
}

function shutdown(signal: string): Promise<void> {
  if (!shutdownPromise) {
    shutdownPromise = (async () => {
      logger.info({ signal }, "shutting down auth service");
      const shutdownErrors: unknown[] = [];

      if (server) {
        await new Promise<void>((resolve, reject) => {
          server?.close((error) => (error ? reject(error) : resolve()));
        }).catch((error: unknown) => shutdownErrors.push(error));
      }

      if (redisClient.isOpen) {
        await redisClient.quit().catch((error: unknown) => shutdownErrors.push(error));
      }
      await disconnectKafka().catch((error: unknown) => shutdownErrors.push(error));
      await shutdownTelemetry().catch((error: unknown) => shutdownErrors.push(error));

      for (const error of shutdownErrors) {
        logger.error({ err: error }, "error during graceful shutdown");
      }
      if (shutdownErrors.length > 0) {
        process.exitCode = 1;
      }
    })();
  }
  return shutdownPromise;
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void start().catch(async (error: unknown) => {
  logger.fatal({ err: error }, "failed to start auth service");
  await shutdown("startup failure");
  process.exitCode = 1;
});
