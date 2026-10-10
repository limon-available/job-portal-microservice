import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { createLogger } from "@hireheaven/shared";
import { env } from "../config/env.js";
import { incrementJobViews } from "../repositories/jobs.js";

const logger = createLogger({ level: env.LOG_LEVEL });
const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
const ACTIVE_BUFFER = "job:views:pending";
let flushing = false;

export const connectRedis = async (): Promise<void> => {
  await redis.connect();
};

export const queueJobView = async (jobId: number): Promise<number> => {
  return redis.hincrby(ACTIVE_BUFFER, String(jobId), 1);
};

export const flushJobViews = async (): Promise<void> => {
  if (flushing) return;
  flushing = true;
  const snapshot = `${ACTIVE_BUFFER}:${randomUUID()}`;
  try {
    if ((await redis.exists(ACTIVE_BUFFER)) === 0) return;
    await redis.rename(ACTIVE_BUFFER, snapshot);
    const values = await redis.hgetall(snapshot);
    for (const [jobIdValue, countValue] of Object.entries(values)) {
      try {
        await incrementJobViews(Number(jobIdValue), Number(countValue));
        await redis.hdel(snapshot, jobIdValue);
      } catch (error) {
        logger.error({ err: error, jobId: jobIdValue }, "could not flush job view count");
        await redis.hincrby(ACTIVE_BUFFER, jobIdValue, Number(countValue));
        await redis.hdel(snapshot, jobIdValue);
      }
    }
    await redis.del(snapshot);
  } finally {
    flushing = false;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (redis.status === "ready") {
    await redis.quit();
  } else if (redis.status !== "end") {
    redis.disconnect();
  }
};
