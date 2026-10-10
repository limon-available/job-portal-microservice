"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type UserRole = "jobseeker" | "recruiter" | "admin";

export interface SessionUser {
  user_id: number;
  name: string;
  email: string;
  role: UserRole;
  [key: string]: unknown;
}

interface AuthState {
  accessToken: string | null;
  user: SessionUser | null;
  setSession: (accessToken: string, user: SessionUser) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(persist<AuthState, [], [], Pick<AuthState, "user">>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => {
    document.cookie = `session_role=${encodeURIComponent(user.role)}; Path=/; Max-Age=604800; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    set({ accessToken, user });
  },
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => {
    document.cookie = "session_role=; Path=/; Max-Age=0; SameSite=Lax";
    set({ accessToken: null, user: null });
  },
}), {
  name: "hireheaven-session",
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({ user: state.user }),
  merge: (persisted, current) => ({ ...current, ...persisted }),
}));
