import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { AppError, createLogger, KAFKA_TOPICS, Role } from "./index.js";

describe("shared primitives", () => {
  it("exports stable Kafka topics and roles", () => {
    expect(KAFKA_TOPICS.UserRegistered).toBe("user.registered");
    expect(KAFKA_TOPICS.PasswordResetRequested).toBe("user.password_reset_requested");
    expect(KAFKA_TOPICS.JobCreated).toBe("job.created");
    expect(Role.Admin).toBe("admin");
  });

  it("exposes operational status metadata on AppError", () => {
    const error = new AppError(409, "Conflict");
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(409);
    expect(error.isOperational).toBe(true);
  });

  it("redacts passwords, tokens, authorization, cookies, and internal keys", () => {
    let output = "";
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ level: "info" }, destination);
    logger.info({
      password: "password-secret",
      accessToken: "access-token-secret",
      refreshToken: "refresh-token-secret",
      authorization: "bearer-secret",
      headers: {
        cookie: "cookie-secret",
        "set-cookie": "set-cookie-secret",
        "x-internal-key": "internal-key-secret",
        "x-gateway-key": "gateway-key-secret",
      },
    }, "request");

    expect(output).not.toContain("password-secret");
    expect(output).not.toContain("access-token-secret");
    expect(output).not.toContain("refresh-token-secret");
    expect(output).not.toContain("bearer-secret");
    expect(output).not.toContain("cookie-secret");
    expect(output).not.toContain("set-cookie-secret");
    expect(output).not.toContain("internal-key-secret");
    expect(output).not.toContain("gateway-key-secret");
    expect(output).toContain("[REDACTED]");
  });
});
