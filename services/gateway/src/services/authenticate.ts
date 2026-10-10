import Jwt, { type JwtPayload } from "jsonwebtoken";
import { AppError, Role } from "@hireheaven/shared";
import { z } from "zod";
import { env } from "../config/env.js";

interface BlacklistStore {
  exists(key: string): Promise<number>;
}

const claimsSchema = z.object({
  id: z.number().int().positive().safe(),
  jti: z.string().min(1),
  exp: z.number().int().positive(),
  purpose: z.literal("access"),
});

const identitySchema = z.object({
  user_id: z.union([z.number(), z.string()]),
  role: z.nativeEnum(Role),
});

export const authenticateRequest = async (
  authorization: string | undefined,
  authServiceUrl: string,
  internalApiKey: string,
  redis: BlacklistStore,
): Promise<{ userId: number; role: Role; tokenId: string; tokenExpiresAt: number }> => {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) throw new AppError(401, "Authentication required");

  let decoded: string | JwtPayload;
  try {
    decoded = Jwt.verify(match[1], env.JWT_SEC, { algorithms: ["HS256"] });
  } catch {
    throw new AppError(401, "Invalid or expired access token");
  }
  const claims = claimsSchema.safeParse(decoded);
  if (!claims.success) throw new AppError(401, "Invalid access token");
  if (await redis.exists(`blacklist:${claims.data.jti}`)) {
    throw new AppError(401, "Access token has been revoked");
  }

  let response: Response;
  try {
    response = await fetch(
      `${authServiceUrl}/api/auth/internal/users/${claims.data.id}`,
      { headers: { "x-internal-key": internalApiKey }, signal: AbortSignal.timeout(5000) },
    );
  } catch {
    throw new AppError(503, "Authentication service is unavailable");
  }
  if (response.status === 404) throw new AppError(401, "User no longer exists");
  if (!response.ok) throw new AppError(503, "Authentication service is unavailable");
  const payload: unknown = await response.json();
  const parsed = z.object({ data: z.object({ user: identitySchema }) }).safeParse(payload);
  if (!parsed.success || Number(parsed.data.data.user.user_id) !== claims.data.id) {
    throw new AppError(401, "Invalid user identity");
  }
  return {
    userId: claims.data.id,
    role: parsed.data.data.user.role,
    tokenId: claims.data.jti,
    tokenExpiresAt: claims.data.exp,
  };
};
