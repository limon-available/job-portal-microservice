import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DB_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SEC: z.string().min(32),
  RESET_JWT_SEC: z.string().min(32),
  REFRESH_JWT_SEC: z.string().min(32),
  EMAIL_VERIFY_JWT_SEC: z.string().min(32),
  KAFKA_BROKER: z.string()
    .min(1)
    .transform((value) => value.split(",").map((broker) => broker.trim()))
    .pipe(z.array(z.string().min(1)).min(1)),
  UPLOAD_SERVICE: z.string().url(),
  INTERNAL_API_KEY: z.string().min(32),
  GATEWAY_INTERNAL_KEY: z.string().min(32).optional(),
  FRONTEND_URL: z.string().url(),
  CORS_ORIGINS: z.string()
    .min(1)
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()).min(1)),
});

const parsedEnv = envSchema.superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.GATEWAY_INTERNAL_KEY) {
    context.addIssue({
      code: "custom",
      path: ["GATEWAY_INTERNAL_KEY"],
      message: "Required in production",
    });
  }
}).safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid auth service environment: ${details}`);
}

export const env = parsedEnv.data;
