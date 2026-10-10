"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Heart } from "lucide-react";
import { api, apiMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button, Notice } from "@/components/ui";

export function SaveJobButton({ jobId }: { jobId: number }) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function save() {
    if (!user || user.role !== "jobseeker") return;
    setPending(true);
    setMessage("");
    try {
      await api.post("/api/user/saved-jobs", { jobId: String(jobId) });
      setMessage("Saved to your list.");
      await queryClient.invalidateQueries({ queryKey: ["saved-jobs"] });
    } catch (error) {
      setMessage(apiMessage(error));
    } finally { setPending(false); }
  }
  if (user?.role !== "jobseeker") return null;
  return <div className="space-y-2"><Button variant="outline" disabled={pending} onClick={() => void save()}><Heart size={16} />{pending ? "Saving…" : "Save job"}</Button>{message && <Notice tone={message === "Saved to your list." ? "success" : "error"}>{message}</Notice>}</div>;
}
