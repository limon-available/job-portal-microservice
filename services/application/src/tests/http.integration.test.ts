import { describe, expect, it } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.DB_URL = "postgres://localhost/application_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKER = "localhost:9092";
process.env.GATEWAY_INTERNAL_KEY = "application-test-gateway-key-at-least-32";
process.env.JOB_SERVICE_URL = "http://localhost:5003";
process.env.AUTH_SERVICE_URL = "http://localhost:5000";
process.env.INTERNAL_API_KEY = "application-test-internal-key-at-least-32";

const { default: app } = await import("../app.js");

describe("application HTTP integration", () => {
  it("serves health and Prometheus metrics", async () => {
    await request(app).get("/health").expect(200);
    const response = await request(app).get("/metrics").expect(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("http_server_requests_total");
    expect(response.text).toContain('service="application"');
  });
});
