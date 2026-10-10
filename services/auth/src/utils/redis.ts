import { createClient } from "redis";
import { createLogger } from "@hireheaven/shared";
import { env } from "../config/env.js";

const logger = createLogger({ level: env.LOG_LEVEL });

export const redisClient = createClient({ url: env.REDIS_URL });

redisClient.on("error", (error) => {
  logger.error({ err: error }, "Redis client error");
});
