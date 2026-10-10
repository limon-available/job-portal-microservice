import { describe, expect, it } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.DB_URL = "postgres://localhost/notification_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKER = "localhost:9092";
process.env.GATEWAY_INTERNAL_KEY = "notification-test-gateway-key-at-least-32";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.SMTP_HOST = "localhost";
process.env.SMTP_PORT = "1025";
process.env.SMTP_USER = "test";
process.env.SMTP_PASS = "test";
process.env.EMAIL_FROM = "test@example.test";

const { default: app } = await import("../app.js");

describe("notification HTTP integration", () => {
  it("serves health and Prometheus metrics", async () => {
    await request(app).get("/health").expect(200);
    const response = await request(app).get("/metrics").expect(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("http_server_requests_total");
    expect(response.text).toContain('service="notification"');
  });
});
