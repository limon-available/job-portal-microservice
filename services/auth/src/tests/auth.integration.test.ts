import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const mocks = vi.hoisted(() => {
  type MockUser = {
    user_id: number;
    name: string;
    email: string;
    password: string;
    phone_number: string;
    role: "jobseeker" | "recruiter" | "admin";
    bio: string;
    resume: string | null;
    resume_public_id: string | null;
    profile_pic: string | null;
    profile_pic_public_id: string | null;
    is_email_verified: boolean;
    created_at: string;
    skills: string[];
  };

  const users: MockUser[] = [];
  const redis = new Map<string, string>();
  const published: Array<{ topic: string; message: Record<string, unknown> }> = [];
  let nextUserId = 1;

  const sql = async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Record<string, unknown>[]> => {
    const query = strings.join(" ").replace(/\s+/g, " ").toLowerCase();
    if (query.includes("insert into users")) {
      const [name, email, password, phoneNumber, role, bio] = values as [
        string, string, string, string, MockUser["role"], string,
      ];
      const user: MockUser = {
        user_id: nextUserId++,
        name,
        email,
        password,
        phone_number: phoneNumber,
        role,
        bio,
        resume: null,
        resume_public_id: null,
        profile_pic: null,
        profile_pic_public_id: null,
        is_email_verified: false,
        created_at: new Date().toISOString(),
        skills: [],
      };
      users.push(user);
      return [{ ...user }];
    }
    if (query.includes("update users set password=")) {
      const [password, userIdOrEmail] = values;
      const user = users.find((item) =>
        item.user_id === userIdOrEmail || item.email === userIdOrEmail
      );
      if (!user) return [];
      user.password = String(password);
      return [{ user_id: user.user_id }];
    }
    if (query.includes("select password from users")) {
      const user = users.find((item) => item.user_id === values[0]);
      return user ? [{ password: user.password }] : [];
    }
    if (query.includes("update users set is_email_verified=true")) {
      const user = users.find((item) =>
        item.user_id === values[0] && item.email === values[1]
      );
      if (!user || user.is_email_verified) return [];
      user.is_email_verified = true;
      return [{ user_id: user.user_id }];
    }
    if (query.includes("select user_id from users where user_id=")) {
      const user = users.find((item) => item.user_id === values[0]);
      return user ? [{ user_id: user.user_id }] : [];
    }
    if (query.includes("select user_id,name,email,phone_number,role,bio,is_email_verified")) {
      const user = users.find((item) => item.user_id === values[0]);
      return user ? [{
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
        bio: user.bio,
        is_email_verified: user.is_email_verified,
      }] : [];
    }
    if (query.includes("select user_id,name,email,role from users")) {
      const user = users.find((item) => item.user_id === values[0]);
      return user ? [{
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      }] : [];
    }
    if (query.includes("select u.user_id")) {
      const user = users.find((item) => item.email === values[0]);
      return user ? [{ ...user }] : [];
    }
    if (query.includes("select user_id,email from users where email=") ||
        query.includes("select user_id from users where email=")) {
      const user = users.find((item) => item.email === values[0]);
      return user ? [{ user_id: user.user_id, email: user.email }] : [];
    }
    return [];
  };

  const redisClient = {
    on: vi.fn(),
    set: vi.fn(async (key: string, value: string) => {
      redis.set(key, value);
      return "OK";
    }),
    get: vi.fn(async (key: string) => redis.get(key) ?? null),
    exists: vi.fn(async (key: string) => Number(redis.has(key))),
    del: vi.fn(async (key: string) => Number(redis.delete(key))),
    eval: vi.fn(async (_script: string, options: { keys: string[]; arguments: string[] }) => {
      const key = options.keys[0];
      const expectedHash = options.arguments[0];
      if (key && expectedHash && redis.get(key) === expectedHash) {
        redis.delete(key);
        return 1;
      }
      return 0;
    }),
    sendCommand: vi.fn(async () => "0"),
    scanIterator: async function* (options: { MATCH: string }) {
      const prefix = options.MATCH.replace("*", "");
      for (const key of redis.keys()) {
        if (key.startsWith(prefix)) yield key;
      }
    },
  };

  return {
    users,
    redis,
    published,
    sql,
    redisClient,
    publishToTopic: vi.fn(async (topic: string, message: Record<string, unknown>) => {
      published.push({ topic, message });
    }),
    reset() {
      users.splice(0);
      redis.clear();
      published.splice(0);
      nextUserId = 1;
    },
  };
});

vi.mock("../utils/db.js", () => ({ sql: mocks.sql }));
vi.mock("../utils/redis.js", () => ({ redisClient: mocks.redisClient }));
vi.mock("../producer.js", () => ({ publishToTopic: mocks.publishToTopic }));
vi.mock("../middleware/authRateLimit.js", () => ({
  loginRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
  forgotRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

process.env.NODE_ENV = "test";
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

const register = () => request(app).post("/api/auth/register").send({
  name: "Test Recruiter",
  email: "test@example.com",
  password: "original-password",
  phoneNumber: "5551234567",
  role: "recruiter",
  bio: "Hiring engineers",
});

const accessTokenFrom = (response: request.Response): string =>
  response.body.data.accessToken as string;

const refreshCookieFrom = (response: request.Response): string => {
  const cookie = response.headers["set-cookie"]?.[0]?.split(";")[0];
  if (!cookie) throw new Error("Expected refresh cookie");
  return cookie;
};

beforeEach(() => {
  mocks.reset();
  vi.clearAllMocks();
});

describe("auth endpoints", () => {
  it("requires an internal key for trusted identity lookups", async () => {
    const registration = await register().expect(201);
    const userId = registration.body.data.user.user_id as number;

    await request(app).get(`/api/auth/internal/users/${userId}`).expect(401);
    const response = await request(app)
      .get(`/api/auth/internal/users/${userId}`)
      .set("x-internal-key", "auth-test-internal-key-at-least-32-characters")
      .expect(200);

    expect(response.body.data.user).toEqual({
      user_id: userId,
      name: "Test Recruiter",
      email: "test@example.com",
      role: "recruiter",
    });
    expect(JSON.stringify(response.body)).not.toContain("password");
  });

  it("registers users, stores bio, issues tokens, and publishes user.registered", async () => {
    const response = await register().expect(201);
    const user = mocks.users[0];
    const event = mocks.published.find(({ topic }) => topic === "user.registered");

    expect(user?.bio).toBe("Hiring engineers");
    expect(user?.is_email_verified).toBe(false);
    expect(accessTokenFrom(response)).toBeTruthy();
    expect(refreshCookieFrom(response)).toContain("refreshToken=");
    expect(response.headers["set-cookie"]?.[0]).toMatch(/HttpOnly/i);
    expect(response.headers["set-cookie"]?.[0]).toMatch(/Secure/i);
    expect(event?.message).toMatchObject({
      userId: user?.user_id,
      email: "test@example.com",
    });
    expect(event?.message.verificationToken).toBeTruthy();
    expect([...mocks.redis.keys()].some((key) => key.startsWith("refresh:1:"))).toBe(true);
  });

  it("logs in and returns a protected current-user response", async () => {
    await register().expect(201);
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "original-password" })
      .expect(200);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessTokenFrom(loginResponse)}`)
      .expect(200);
    expect(response.body.data.user.email).toBe("test@example.com");
  });

  it("rotates refresh tokens and revokes the session when a token is reused", async () => {
    const registration = await register().expect(201);
    const oldCookie = refreshCookieFrom(registration);

    const firstRefresh = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", oldCookie)
      .expect(200);
    const newCookie = refreshCookieFrom(firstRefresh);
    expect(newCookie).not.toBe(oldCookie);

    await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", oldCookie)
      .expect(401);
    expect([...mocks.redis.keys()].filter((key) => key.startsWith("refresh:1:"))).toHaveLength(0);
  });

  it("blacklists access and removes the refresh token on logout", async () => {
    const registration = await register().expect(201);
    const accessToken = accessTokenFrom(registration);
    const cookie = refreshCookieFrom(registration);
    const claims = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString());

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", cookie)
      .expect(200);

    expect(mocks.redis.has(`blacklist:${claims.jti}`)).toBe(true);
    expect([...mocks.redis.keys()].filter((key) => key.startsWith("refresh:1:"))).toHaveLength(0);
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(401);
  });

  it("resets the password and consumes the reset token", async () => {
    await register().expect(201);
    await request(app)
      .post("/api/auth/forgot")
      .send({ email: "test@example.com" })
      .expect(200);
    const resetEvent = mocks.published.find(
      ({ topic }) => topic === "user.password_reset_requested",
    );
    expect(resetEvent?.message).toMatchObject({
      userId: 1,
      email: "test@example.com",
    });
    expect(resetEvent?.message).not.toHaveProperty("html");
    expect(resetEvent?.message).not.toHaveProperty("to");
    const resetToken = mocks.redis.get("forgot:test@example.com");
    expect(resetToken).toBeTruthy();

    await request(app)
      .post(`/api/auth/reset/${resetToken}`)
      .send({ password: "replacement-password" })
      .expect(200);
    expect(mocks.redis.has("forgot:test@example.com")).toBe(false);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "replacement-password" })
      .expect(200);
  });

  it("verifies the email using the registration event token", async () => {
    await register().expect(201);
    const event = mocks.published.find(({ topic }) => topic === "user.registered");
    const token = event?.message.verificationToken;

    await request(app).get(`/api/auth/verify-email/${token}`).expect(200);
    expect(mocks.users[0]?.is_email_verified).toBe(true);
  });
});
