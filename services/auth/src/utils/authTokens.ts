import { createHash, randomUUID } from "node:crypto";
import type { Response } from "express";
import Jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { redisClient } from "./redis.js";

export const REFRESH_TOKEN_COOKIE = "refreshToken";
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/api/auth",
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RefreshClaims extends JwtPayload {
  id: number;
  jti: string;
  purpose: "refresh";
}

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const issueTokenPair = async (userId: number): Promise<TokenPair> => {
  const refreshTokenId = randomUUID();
  const accessToken = Jwt.sign(
    { id: userId, purpose: "access" },
    env.JWT_SEC,
    { expiresIn: "15m", jwtid: randomUUID() },
  );
  const refreshToken = Jwt.sign(
    { id: userId, purpose: "refresh" },
    env.REFRESH_JWT_SEC,
    { expiresIn: "7d", jwtid: refreshTokenId },
  );

  const redisKey = `refresh:${userId}:${refreshTokenId}`;
  const refreshTokenHash = hashToken(refreshToken);
  const stored = await redisClient.set(redisKey, refreshTokenHash, {
    EX: REFRESH_TOKEN_TTL_SECONDS,
    NX: true,
  });
  if (stored !== "OK") {
    throw new Error("Could not store refresh token");
  }

  return { accessToken, refreshToken };
};

export const setRefreshCookie = (res: Response, refreshToken: string): void => {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_TOKEN_COOKIE, REFRESH_COOKIE_OPTIONS);
};

export const verifyRefreshToken = (token: string): RefreshClaims | null => {
  try {
    const claims = Jwt.verify(token, env.REFRESH_JWT_SEC);
    if (
      typeof claims === "string" ||
      typeof claims.id !== "number" ||
      typeof claims.jti !== "string" ||
      claims.purpose !== "refresh"
    ) {
      return null;
    }
    return claims as RefreshClaims;
  } catch {
    return null;
  }
};

export const revokeUserRefreshTokens = async (userId: number): Promise<void> => {
  for await (const key of redisClient.scanIterator({
    MATCH: `refresh:${userId}:*`,
    COUNT: 100,
  })) {
    if (typeof key === "string") {
      await redisClient.del(key);
    }
  }
};

export const revokeRefreshToken = async (
  token: string,
  claims: RefreshClaims,
): Promise<boolean> => {
  const key = `refresh:${claims.id}:${claims.jti}`;
  const result = await redisClient.eval(
    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
    { keys: [key], arguments: [hashToken(token)] },
  );
  if (Number(result) !== 1) {
    await revokeUserRefreshTokens(claims.id);
    return false;
  }
  return true;
};
