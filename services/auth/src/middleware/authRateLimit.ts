import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Request } from "express";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../utils/redis.js";

const redisStore = (prefix: string) => new RedisStore({
  sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  prefix,
});

const keyGenerator = (req: Request) => {
  const email = typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase().slice(0, 255)
    : "";
  const clientIp = req.ip ?? req.socket.remoteAddress ?? "unknown";
  return `${ipKeyGenerator(clientIp)}:${email}`;
};

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator,
  store: redisStore("auth:login:"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many attempts. Please try again later.",
      data: null,
    });
  },
});

export const forgotRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator,
  store: redisStore("auth:forgot:"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many attempts. Please try again later.",
      data: null,
    });
  },
});
