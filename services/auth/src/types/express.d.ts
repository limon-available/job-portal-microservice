import type { JwtPayload } from "jsonwebtoken";
import type { Role } from "@hireheaven/shared";

export interface AuthenticatedUser {
  user_id: number;
  name: string;
  email: string;
  phone_number: string;
  role: Role;
  bio: string | null;
  is_email_verified: boolean;
}

export interface AccessTokenClaims extends JwtPayload {
  id: number;
  jti: string;
  exp: number;
  purpose: "access";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      accessTokenClaims?: AccessTokenClaims;
      accessToken?: string;
    }
  }
}

export {};
