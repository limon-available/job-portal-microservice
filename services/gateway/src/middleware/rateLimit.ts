import type { RequestHandler } from "express";
import { AppError } from "@hireheaven/shared";
import { env } from "../config/env.js";

export interface GatewayRedisClient {
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
  exists(key: string): Promise<number>;
  connect?(): Promise<unknown>;
  quit?(): Promise<unknown>;
  isOpen?: boolean;
}

const incrementRateLimit = async (redis: GatewayRedisClient, key: string): Promise<number> => {
  const value: unknown = await redis.eval(
    "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return count",
    { keys: [key], arguments: [String(env.RATE_LIMIT_WINDOW_SECONDS)] },
  );
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("Redis returned an invalid rate-limit counter");
  }
  return count;
};

export const createRateLimit = (redis: GatewayRedisClient): RequestHandler =>
  (req, res, next) => {
    if (req.path === "/health") {
      next();
      return;
    }
    const address = req.ip || req.socket.remoteAddress || "unknown";
    void incrementRateLimit(redis, `gateway:rate:${address}`)
      .then((count) => {
        res.setHeader("RateLimit-Limit", String(env.RATE_LIMIT_MAX));
        res.setHeader("RateLimit-Remaining", String(Math.max(0, env.RATE_LIMIT_MAX - count)));
        res.setHeader("RateLimit-Reset", String(env.RATE_LIMIT_WINDOW_SECONDS));
        if (count > env.RATE_LIMIT_MAX) {
          next(new AppError(429, "Too many requests"));
          return;
        }
        next();
      })
      .catch((error: unknown) => {
        next(error);
      });
  };
