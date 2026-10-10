import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5003),
  DB_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  KAFKA_BROKER: z.string()
    .min(1)
    .transform((value) => value.split(",").map((broker) => broker.trim()))
    .pipe(z.array(z.string().min(1)).min(1)),
  GATEWAY_INTERNAL_KEY: z.string().min(32),
  UPLOAD_SERVICE: z.string().url(),
  INTERNAL_API_KEY: z.string().min(32),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid job service environment: ${details}`);
}

export const env = parsedEnv.data;
