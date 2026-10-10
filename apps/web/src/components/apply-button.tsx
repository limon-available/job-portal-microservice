"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, apiMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button, Notice } from "@/components/ui";

export function ApplyButton({ jobId }: { jobId: number }) {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: async () => api.post("/api/applications/apply", { jobId }),
  });
  if (!user) return <Button onClick={() => router.push(`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`)}>Sign in to apply</Button>;
  if (user.role !== "jobseeker") return <Notice>Jobseeker accounts can apply to this role.</Notice>;
  return <div className="space-y-3"><Button disabled={mutation.isPending || mutation.isSuccess} onClick={() => mutation.mutate()}>{mutation.isSuccess ? "Application sent" : mutation.isPending ? "Applying…" : "Apply for this job"}</Button>{mutation.isError && <Notice tone="error">{apiMessage(mutation.error)}</Notice>}{mutation.isSuccess && <Notice tone="success">Your application has been submitted.</Notice>}</div>;
}
