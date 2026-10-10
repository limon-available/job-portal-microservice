import axios from "axios";
import { AppError, createLogger } from "@hireheaven/shared";
import { z } from "zod";
import { env } from "../config/env.js";

const logger = createLogger({ level: env.LOG_LEVEL });
const identitySchema = z.object({
  user_id: z.union([z.number(), z.string()]),
  name: z.string().min(1),
  email: z.string().email(),
});

export type UserIdentity = z.infer<typeof identitySchema>;

export const getUserIdentity = async (userId: number): Promise<UserIdentity> => {
  try {
    const response = await axios.get<{ data: { user: unknown } }>(
      `${env.AUTH_SERVICE_URL}/api/auth/internal/users/${userId}`,
      { headers: { "x-internal-key": env.INTERNAL_API_KEY }, timeout: 5000 },
    );
    return identitySchema.parse(response.data.data.user);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new AppError(404, "User not found");
    }
    logger.error({ err: error, userId }, "auth service identity lookup failed");
    if (error instanceof AppError) throw error;
    throw new AppError(502, "Auth service is unavailable");
  }
};
