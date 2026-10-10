"use client";

import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/lib/auth-store";
import type { SessionUser } from "@/lib/auth-store";
import { z } from "zod";

const baseURL = process.env.NEXT_PUBLIC_GATEWAY_URL;
if (!baseURL) {
  throw new Error("NEXT_PUBLIC_GATEWAY_URL must be configured for the web app");
}

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

const refreshClient = axios.create({ baseURL, withCredentials: true });
let refreshPromise: Promise<string | null> | null = null;
const userSchema = z.object({
  user_id: z.number().int().positive(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["jobseeker", "recruiter", "admin"]),
}).passthrough();

api.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status !== 401 || !original || original._retried ||
        original.url?.includes("/api/auth/refresh") || original.url?.includes("/api/auth/login")) {
      return Promise.reject(error);
    }
    original._retried = true;
    refreshPromise ??= refreshClient.post("/api/auth/refresh")
      .then(async (response) => {
        const token: unknown = response.data?.data?.accessToken;
        if (typeof token !== "string" || token.length === 0) {
          throw new Error("Refresh endpoint did not return an access token");
        }
        useAuthStore.getState().setAccessToken(token);
        const me = await api.get("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const parsedUser = userSchema.safeParse(me.data?.data?.user);
        if (!parsedUser.success) {
          throw new Error("Authentication endpoint returned an invalid user");
        }
        useAuthStore.getState().setSession(token, parsedUser.data satisfies SessionUser);
        return token;
      })
      .catch(() => {
        useAuthStore.getState().clearSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
    const token = await refreshPromise;
    if (!token) return Promise.reject(error);
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  },
);

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export function apiMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.message;
    if (typeof message === "string") return message;
  }
  return error instanceof Error ? error.message : "Something went wrong";
}
