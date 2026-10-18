import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Express } from "express";
import Jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const jwtSecret = "gateway-test-access-token-secret-with-32-characters";
let upstream: Server;
let app: Express;
const proxied: Array<{
  path: string;
  headers: IncomingMessage["headers"];
}> = [];

const respond = (req: IncomingMessage, res: ServerResponse): void => {
  const path = req.url ?? "/";
  if (path === "/api/auth/internal/users/7") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        message: "User identity",
        data: {
          user: { user_id: 7, name: "Casey", email: "casey@example.test", role: "jobseeker" },
        },
      }),
    );
    return;
  }
  if (path === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  proxied.push({ path, headers: req.headers });
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      success: true,
      path,
      userId: req.headers["x-user-id"] ?? null,
      role: req.headers["x-user-role"] ?? null,
    }),
  );
};

beforeAll(async () => {
  upstream = createServer(respond);
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  if (!address || typeof address === "string")
    throw new Error("Test upstream did not bind a TCP port");
  const url = `http://127.0.0.1:${address.port}`;
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
  process.env.PORT = "8080";
  process.env.JWT_SEC = jwtSecret;
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.GATEWAY_INTERNAL_KEY = "gateway-test-private-key-at-least-32-characters";
  process.env.INTERNAL_API_KEY = "gateway-test-internal-key-at-least-32-characters";
  process.env.CORS_ORIGINS = "http://localhost:3000";
  process.env.RATE_LIMIT_MAX = "100";
  process.env.AUTH_SERVICE_URL = url;
  process.env.USER_SERVICE_URL = url;
  process.env.JOB_SERVICE_URL = url;
  process.env.APPLICATION_SERVICE_URL = url;
  process.env.NOTIFICATION_SERVICE_URL = url;
  process.env.UTILS_SERVICE_URL = url;
  const { createApp } = await import("../app.js");
  app = createApp({
    eval: async () => 1,
    exists: async () => 0,
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    upstream.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("gateway route protection and proxy headers", () => {
  it("exposes Prometheus metrics without requiring Redis authentication", async () => {
    const response = await request(app).get("/metrics").expect(200);
    expect(response.text).toContain("http_server_requests_total");
    expect(response.text).toContain('service="gateway"');
  });

  it("allows public auth routes but requires access JWTs for protected routes", async () => {
    await request(app)
      .post("/api/auth/login")
      .set("x-user-id", "900")
      .set("x-user-role", "admin")
      .expect(200);
    await request(app)
      .get("/api/auth/me")
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Authentication required");
      });

    await request(app)
      .get("/api/jobs/companies")
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Authentication required");
      });

    const loginRequest = proxied.find(({ path }) => path === "/api/auth/login");
    expect(loginRequest?.headers["x-user-id"]).toBeUndefined();
    expect(loginRequest?.headers["x-user-role"]).toBeUndefined();
    expect(loginRequest?.headers["x-gateway-key"]).toBe(
      "gateway-test-private-key-at-least-32-characters",
    );
    expect(loginRequest?.headers["x-internal-key"]).toBe(
      "gateway-test-internal-key-at-least-32-characters",
    );
  });

  it("verifies JWTs and overwrites spoofed x-user headers with trusted identity", async () => {
    const accessToken = Jwt.sign({ id: 7, purpose: "access" }, jwtSecret, {
      expiresIn: "15m",
      jwtid: "trusted-token",
    });
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-user-id", "900")
      .set("x-user-role", "admin")
      .expect(200);

    expect(response.body).toMatchObject({
      path: "/api/auth/me",
      userId: "7",
      role: "jobseeker",
    });
    const proxiedRequest = proxied.find(({ path }) => path === "/api/auth/me");
    expect(proxiedRequest?.headers["x-user-id"]).toBe("7");
    expect(proxiedRequest?.headers["x-user-role"]).toBe("jobseeker");
    expect(proxiedRequest?.headers.authorization).toBe(`Bearer ${accessToken}`);
    expect(proxiedRequest?.headers["x-access-token-id"]).toBe("trusted-token");
    expect(Number(proxiedRequest?.headers["x-access-token-exp"])).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    );
  });

  it("rewrites notification routes and refuses direct utility/internal routes", async () => {
    const accessToken = Jwt.sign({ id: 7, purpose: "access" }, jwtSecret, {
      expiresIn: "15m",
      jwtid: "notifications-token",
    });
    await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(proxied.some(({ path }) => path === "/notifications/unread-count")).toBe(true);

    await request(app).post("/api/utils/upload").expect(404);
    await request(app).get("/api/auth/internal/users/7").expect(404);
    await request(app).get("/api/jobs/internal/jobs/7").expect(404);
  });

  it("aggregates service health", async () => {
    await request(app)
      .get("/health")
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
        expect(Object.values(body.data.services).every(Boolean)).toBe(true);
      });
  });
});
