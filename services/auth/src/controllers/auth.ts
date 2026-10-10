import { TryCatch } from "../utils/TryCatch.js";
import { AppError, Role, KAFKA_TOPICS } from "@hireheaven/shared";
import type { UserRegistered } from "@hireheaven/shared";
import { sql } from "../utils/db.js";
import Jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import axios from "axios";
import { publishToTopic } from "../producer.js";
import { redisClient } from "../utils/redis.js";
import { env } from "../config/env.js";
import { randomUUID } from "node:crypto";
import {
  clearRefreshCookie,
  issueTokenPair,
  REFRESH_TOKEN_COOKIE,
  revokeRefreshToken,
  revokeUserRefreshTokens,
  setRefreshCookie,
  verifyRefreshToken,
} from "../utils/authTokens.js";

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "23505";

export const registerUser = TryCatch(async (req, res) => {
  const { email, name, password, phoneNumber, role, bio } = req.body;
  const existingUsers = await sql`
    SELECT user_id FROM users WHERE email=${email}
  `;
  if (existingUsers.length > 0) {
    throw new AppError(409, "User already exists");
  }

  const hashPassword = await bcrypt.hash(password, 10);
  let registeredUser;

  try {
    if (role === Role.Recruiter) {
      const [user] = await sql`
        INSERT INTO users(name,email,password,phone_number,role,bio)
        VALUES(${name},${email},${hashPassword},${phoneNumber},${role},${bio})
        RETURNING user_id,name,email,phone_number,role,bio,is_email_verified,created_at
      `;
      registeredUser = user;
    } else {
      const file = req.file;
      if (!file) {
        throw new AppError(400, "Resume file is required for jobseekers");
      }
      const uploadBody = new FormData();
      uploadBody.append("file", new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype,
      }), file.originalname);
      uploadBody.append("folder", "resumes");
      const { data } = await axios.post<{
        success: boolean;
        message: string;
        data: { url: string; public_id: string };
      }>(
        `${env.UPLOAD_SERVICE}/api/utils/upload`,
        uploadBody,
        { headers: { "x-internal-key": env.INTERNAL_API_KEY } },
      );
      const [user] = await sql`
        INSERT INTO users(name,email,password,phone_number,role,bio,resume,resume_public_id)
        VALUES(${name},${email},${hashPassword},${phoneNumber},${role},${bio},${data.data.url},${data.data.public_id})
        RETURNING user_id,name,email,phone_number,role,bio,is_email_verified,resume,created_at
      `;
      registeredUser = user;
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "User already exists");
    }
    throw error;
  }

  if (!registeredUser) {
    throw new AppError(500, "Failed to register user", false);
  }

  const verificationToken = Jwt.sign(
    { id: registeredUser.user_id, email, purpose: "verify-email" },
    env.EMAIL_VERIFY_JWT_SEC,
    { expiresIn: "24h" },
  );
  const registrationEvent: UserRegistered = {
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    userId: registeredUser.user_id,
    email,
    name,
    verificationToken,
  };
  await publishToTopic(KAFKA_TOPICS.UserRegistered, registrationEvent);
  const tokens = await issueTokenPair(registeredUser.user_id);
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: { user: registeredUser, accessToken: tokens.accessToken },
  });
});

export const getInternalUser = TryCatch(async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new AppError(400, "Invalid user ID");
  }
  const [user] = await sql`
    SELECT user_id,name,email,role FROM users WHERE user_id=${userId}
  `;
  if (!user) throw new AppError(404, "User not found");
  res.json({
    success: true,
    message: "User identity",
    data: { user },
  });
});

export const loginUser = TryCatch(async (req, res) => {
  const { email, password } = req.body;
  const users = await sql`
    SELECT u.user_id,u.name,u.email,u.password,u.phone_number,u.role,u.bio,u.resume,u.profile_pic,
      u.subscription,ARRAY_AGG(s.name) FILTER (where s.name IS NOT NULL) as skills
    FROM users u
    LEFT JOIN user_skills us ON u.user_id=us.user_id
    LEFT JOIN skills s ON us.skill_id=s.skill_id
    WHERE u.email=${email}
    GROUP BY u.user_id
  `;
  const user = users[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError(401, "Invalid credentials");
  }

  const { password: _password, ...userObject } = user;
  const tokens = await issueTokenPair(user.user_id);
  setRefreshCookie(res, tokens.refreshToken);
  res.json({
    success: true,
    message: "User logged in successfully",
    data: {
      user: { ...userObject, skills: userObject.skills ?? [] },
      accessToken: tokens.accessToken,
    },
  });
});

export const getMe = TryCatch(async (req, res) => {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }
  res.json({
    success: true,
    message: "Current user",
    data: { user: req.user },
  });
});

export const refreshSession = TryCatch(async (req, res) => {
  const refreshToken: unknown = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof refreshToken !== "string") {
    throw new AppError(401, "Refresh token is required");
  }
  const claims = verifyRefreshToken(refreshToken);
  if (!claims) {
    clearRefreshCookie(res);
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const users = await sql`
    SELECT user_id FROM users WHERE user_id=${claims.id}
  `;
  if (users.length === 0) {
    clearRefreshCookie(res);
    await revokeUserRefreshTokens(claims.id);
    throw new AppError(401, "User no longer exists");
  }

  if (!(await revokeRefreshToken(refreshToken, claims))) {
    clearRefreshCookie(res);
    throw new AppError(401, "Refresh token reuse detected; sign in again");
  }
  const tokens = await issueTokenPair(claims.id);
  setRefreshCookie(res, tokens.refreshToken);
  res.json({
    success: true,
    message: "Tokens refreshed successfully",
    data: { accessToken: tokens.accessToken },
  });
});

export const logout = TryCatch(async (req, res) => {
  const accessClaims = req.accessTokenClaims;
  if (!accessClaims || !req.accessToken) {
    throw new AppError(401, "Authentication required");
  }

  const ttl = accessClaims.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redisClient.set(`blacklist:${accessClaims.jti}`, "1", { EX: ttl });
  }

  const refreshToken: unknown = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof refreshToken === "string") {
    const refreshClaims = verifyRefreshToken(refreshToken);
    if (refreshClaims && refreshClaims.id === req.user?.user_id) {
      await redisClient.del(`refresh:${refreshClaims.id}:${refreshClaims.jti}`);
    }
  }
  clearRefreshCookie(res);
  res.json({ success: true, message: "Logged out successfully", data: null });
});

export const changePassword = TryCatch(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new AppError(401, "Authentication required");
  }

  const users = await sql`
    SELECT password FROM users WHERE user_id=${user.user_id}
  `;
  const storedPassword: unknown = users[0]?.password;
  if (typeof storedPassword !== "string" ||
    !(await bcrypt.compare(req.body.currentPassword, storedPassword))) {
    throw new AppError(400, "Current password is incorrect");
  }

  const passwordHash = await bcrypt.hash(req.body.password, 10);
  await sql`UPDATE users SET password=${passwordHash} WHERE user_id=${user.user_id}`;
  await revokeUserRefreshTokens(user.user_id);

  const accessClaims = req.accessTokenClaims;
  if (accessClaims) {
    const ttl = accessClaims.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redisClient.set(`blacklist:${accessClaims.jti}`, "1", { EX: ttl });
    }
  }

  clearRefreshCookie(res);
  res.json({ success: true, message: "Password changed successfully", data: null });
});

export const verifyEmail = TryCatch(async (req, res) => {
  const { token } = req.params;
  let decoded: string | Jwt.JwtPayload;
  try {
    decoded = Jwt.verify(token, env.EMAIL_VERIFY_JWT_SEC);
  } catch {
    throw new AppError(400, "Invalid or expired verification token");
  }

  if (
    typeof decoded === "string" ||
    typeof decoded.id !== "number" ||
    typeof decoded.email !== "string" ||
    decoded.purpose !== "verify-email"
  ) {
    throw new AppError(400, "Invalid verification token");
  }

  const updatedUsers = await sql`
    UPDATE users SET is_email_verified=TRUE
    WHERE user_id=${decoded.id} AND email=${decoded.email}
    RETURNING user_id
  `;
  if (updatedUsers.length === 0) {
    const users = await sql`
      SELECT user_id FROM users
      WHERE user_id=${decoded.id} AND email=${decoded.email} AND is_email_verified=TRUE
    `;
    if (users.length === 0) {
      throw new AppError(400, "Invalid verification token");
    }
  }

  res.json({
    success: true,
    message: "Email verified successfully",
    data: null,
  });
});

export const forgotPassword = TryCatch(async (req, res) => {
  const { email } = req.body;
  const users = await sql`
    SELECT user_id,email FROM users WHERE email=${email}
  `;
  const user = users[0];

  if (user) {
    const resetToken = Jwt.sign(
      { email: user.email, purpose: "reset" },
      env.RESET_JWT_SEC,
      { expiresIn: "15m" },
    );
    await redisClient.set(`forgot:${user.email}`, resetToken, { EX: 900 });

    await publishToTopic(KAFKA_TOPICS.PasswordResetRequested, {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      userId: user.user_id,
      email: user.email,
      resetToken,
    });
  }

  res.json({
    success: true,
    message: "If that email exists, we have sent a reset link",
    data: null,
  });
});

export const resetPassword = TryCatch(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  let decoded: string | Jwt.JwtPayload;
  try {
    decoded = Jwt.verify(token, env.RESET_JWT_SEC);
  } catch {
    throw new AppError(400, "Invalid or expired reset token");
  }

  if (
    typeof decoded === "string" ||
    decoded.purpose !== "reset" ||
    typeof decoded.email !== "string"
  ) {
    throw new AppError(400, "Invalid reset token");
  }

  const redisKey = `forgot:${decoded.email}`;
  const storedToken = await redisClient.get(redisKey);
  if (!storedToken || storedToken !== token) {
    throw new AppError(400, "Invalid or expired reset token");
  }

  const hashPassword = await bcrypt.hash(password, 10);
  const updatedUsers = await sql`
    UPDATE users SET password=${hashPassword}
    WHERE email=${decoded.email}
    RETURNING user_id
  `;
  if (updatedUsers.length === 0) {
    throw new AppError(400, "Invalid or expired reset token");
  }

  await redisClient.del(redisKey);
  await revokeUserRefreshTokens(updatedUsers[0].user_id);
  res.json({
    success: true,
    message: "Password reset successfully",
    data: null,
  });
});
