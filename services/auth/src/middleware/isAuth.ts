import { TryCatch } from "../utils/TryCatch.js";
import { AppError, Role } from "@hireheaven/shared";
import { sql } from "../utils/db.js";
import { env } from "../config/env.js";
import { redisClient } from "../utils/redis.js";
import type { AccessTokenClaims } from "../types/express.js";
import Jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const isAuth = TryCatch(async (req, _res, next) => {
  let gatewayIdentity: { userId: number; role: Role } | undefined;
  let claims: AccessTokenClaims;
  if (env.NODE_ENV === "production") {
    const suppliedKey = req.get("x-gateway-key");
    const expectedKey = Buffer.from(env.GATEWAY_INTERNAL_KEY ?? "");
    const actualKey = Buffer.from(suppliedKey ?? "");
    if (
      !suppliedKey ||
      expectedKey.length !== actualKey.length ||
      !timingSafeEqual(expectedKey, actualKey)
    ) {
      throw new AppError(401, "Trusted gateway identity required");
    }
    const identity = z.object({
      userId: z.coerce.number().int().positive().safe(),
      role: z.nativeEnum(Role),
    }).safeParse({
      userId: req.get("x-user-id"),
      role: req.get("x-user-role"),
    });
    if (!identity.success) throw new AppError(401, "Invalid gateway identity");
    gatewayIdentity = identity.data;

    const forwardedClaims = z.object({
      jti: z.string().min(1),
      exp: z.coerce.number().int().positive(),
    }).safeParse({
      jti: req.get("x-access-token-id"),
      exp: req.get("x-access-token-exp"),
    });
    if (!forwardedClaims.success || forwardedClaims.data.exp <= Math.floor(Date.now() / 1000)) {
      throw new AppError(401, "Invalid or expired access token");
    }
    claims = {
      id: gatewayIdentity.userId,
      jti: forwardedClaims.data.jti,
      exp: forwardedClaims.data.exp,
      purpose: "access",
    };
  } else {
    const authorization = req.get("authorization");
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!match?.[1]) throw new AppError(401, "Authentication required");

    let decoded: string | Jwt.JwtPayload;
    try {
      decoded = Jwt.verify(match[1], env.JWT_SEC);
    } catch {
      throw new AppError(401, "Invalid or expired access token");
    }
    if (
      typeof decoded === "string" ||
      typeof decoded.id !== "number" ||
      typeof decoded.jti !== "string" ||
      typeof decoded.exp !== "number" ||
      decoded.purpose !== "access"
    ) {
      throw new AppError(401, "Invalid access token");
    }
    claims = decoded as AccessTokenClaims;
  }

  if (gatewayIdentity && gatewayIdentity.userId !== claims.id) {
    throw new AppError(401, "Gateway identity does not match access token");
  }
  if (await redisClient.exists(`blacklist:${claims.jti}`)) {
    throw new AppError(401, "Access token has been revoked");
  }

  const users = await sql`
    SELECT user_id,name,email,phone_number,role,bio,is_email_verified
    FROM users WHERE user_id=${claims.id}
  `;
  const user = users[0];
  if (!user) {
    throw new AppError(401, "User no longer exists");
  }
  if (gatewayIdentity && gatewayIdentity.role !== user.role) {
    throw new AppError(401, "Gateway role does not match account");
  }

  req.user = user;
  req.accessTokenClaims = claims;
  const accessToken = req.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!accessToken) throw new AppError(401, "Authentication required");
  req.accessToken = accessToken;
  next();
});
