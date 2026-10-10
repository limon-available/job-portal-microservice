import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5002),
  DB_URL: z.string().url(),
  GATEWAY_INTERNAL_KEY: z.string().min(32),
  UPLOAD_SERVICE: z.string().url(),
  INTERNAL_API_KEY: z.string().min(32),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid user service environment: ${details}`);
}

export const env = parsedEnv.data;
