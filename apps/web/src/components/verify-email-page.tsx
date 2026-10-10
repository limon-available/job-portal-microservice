"use client";

import { useSearchParams } from "next/navigation";
import { VerifyEmail } from "@/components/auth-forms";
import { Notice } from "@/components/ui";

export function VerifyEmailPage() {
  const token = useSearchParams().get("token");
  return token ? <VerifyEmail token={token} /> : <Notice tone="error">Verification link is missing its token.</Notice>;
}
