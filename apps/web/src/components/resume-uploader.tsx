"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, apiMessage } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { Button, Card, Field, Input, Notice, PageHeading } from "@/components/ui";

export function ResumeUploader() {
  const queryClient = useQueryClient();
  const profile = useApiQuery<{ profile: { resume_url?: string | null } }>(
    ["profile"],
    "/api/user/profile",
  );
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) return;
    setPending(true);
    setMessage(null);
    const body = new FormData();
    body.append("file", file);
    try {
      await api.put("/api/user/profile/resume", body);
      setMessage({ text: "Resume uploaded.", error: false });
      setFile(null);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (error) {
      setMessage({ text: apiMessage(error), error: true });
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="Your profile"
        title="Resume"
        description="Upload a current resume so hiring teams can learn more about your experience."
      />
      <Card className="max-w-2xl">
        {profile.data?.profile.resume_url && (
          <p className="mb-5 text-sm">
            Current resume:{" "}
            <a
              className="font-semibold text-primary underline"
              href={profile.data.profile.resume_url}
              target="_blank"
              rel="noreferrer"
            >
              View uploaded resume
            </a>
          </p>
        )}
        {message && (
          <div className="mb-4">
            <Notice tone={message.error ? "error" : "success"}>{message.text}</Notice>
          </div>
        )}
        <form className="grid gap-5" onSubmit={(event) => void submit(event)}>
          <Field label="Resume file (PDF, DOC, DOCX; max 5 MB)">
            <Input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </Field>
          <Button disabled={!file || pending}>{pending ? "Uploading…" : "Upload resume"}</Button>
        </form>
      </Card>
    </>
  );
}
