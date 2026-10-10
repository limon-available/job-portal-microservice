import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import {
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
} from "../validators/auth.js";

process.env.NODE_ENV = "production";
process.env.DB_URL = "postgresql://user:password@localhost/auth";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SEC = "access-secret-for-auth-service-tests-123456";
process.env.RESET_JWT_SEC = "reset-secret-for-auth-service-tests-123456";
process.env.REFRESH_JWT_SEC = "refresh-secret-for-auth-service-tests-123456";
process.env.EMAIL_VERIFY_JWT_SEC = "verification-secret-for-auth-tests-123456";
process.env.KAFKA_BROKER = "localhost:9092";
process.env.UPLOAD_SERVICE = "http://localhost:5001";
process.env.INTERNAL_API_KEY = "auth-test-internal-key-at-least-32-characters";
process.env.GATEWAY_INTERNAL_KEY = "auth-test-gateway-key-at-least-32-characters";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.CORS_ORIGINS = "http://localhost:3000";

const { default: app } = await import("../app.js");
const { default: errorHandler } = await import("../utils/errorHandler.js");

describe("auth request schemas", () => {
  it("accepts the complete register payload", () => {
    expect(registerSchema.safeParse({
      name: "Casey",
      email: "casey@example.com",
      password: "long-password",
      phoneNumber: "5551234567",
      role: "recruiter",
      bio: "Hiring engineer",
    }).success).toBe(true);
  });

  it("rejects invalid login and forgot-password inputs", () => {
    expect(loginSchema.safeParse({ email: "invalid", password: "" }).success).toBe(false);
    expect(forgotSchema.safeParse({ email: "invalid" }).success).toBe(false);
  });

  it("requires a strong-enough replacement password", () => {
    expect(resetSchema.safeParse({ password: "short" }).success).toBe(false);
  });
});

describe("auth service middleware", () => {
  it("serves health with a request ID and security headers", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: { status: "ok" },
    });
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.headers["content-security-policy"]).toBeTruthy();
  });

  it("exposes Prometheus metrics for completed requests", async () => {
    await request(app).get("/health").expect(200);
    const response = await request(app).get("/metrics").expect(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("http_server_requests_total");
    expect(response.text).toContain('service="auth"');
  });

  it("rejects origins outside the configured CORS whitelist", async () => {
    await request(app)
      .get("/health")
      .set("Origin", "https://untrusted.example")
      .expect(403);
  });

  it("does not expose unexpected error details in production", async () => {
    const errorApp = express();
    errorApp.get("/failure", (_req, _res, next) => {
      next(new Error("sensitive stack marker"));
    });
    errorApp.use(errorHandler);

    const response = await request(errorApp).get("/failure").expect(500);
    expect(response.body.message).toBe("Internal server error");
    expect(JSON.stringify(response.body)).not.toContain("sensitive stack marker");
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });
});
