import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  JWT_SEC: z.string().min(32),
  REDIS_URL: z.string().url(),
  GATEWAY_INTERNAL_KEY: z.string().min(32),
  INTERNAL_API_KEY: z.string().min(32),
  CORS_ORIGINS: z.string().min(1)
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()).min(1)),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(60),
  PROXY_TIMEOUT_MS: z.coerce.number().int().min(100).default(8000),
  CIRCUIT_RESET_MS: z.coerce.number().int().min(1000).default(30000),
  AUTH_SERVICE_URL: z.string().url(),
  USER_SERVICE_URL: z.string().url(),
  JOB_SERVICE_URL: z.string().url(),
  APPLICATION_SERVICE_URL: z.string().url(),
  NOTIFICATION_SERVICE_URL: z.string().url(),
  UTILS_SERVICE_URL: z.string().url(),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid gateway environment: ${details}`);
}

export const env = parsedEnv.data;
