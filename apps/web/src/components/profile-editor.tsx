"use client";

import { useEffect } from "react";
import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { api, apiMessage } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { Button, Card, Field, Input, Notice, PageHeading } from "@/components/ui";
import { ErrorState, LoadingCards } from "@/components/query-state";

interface Profile {
  name: string;
  phone: string;
  bio: string;
  picture_url?: string | null;
  resume_url?: string | null;
}

export function ProfileEditor() {
  const [pictureError, setPictureError] = useState("");
  const [pictureSaved, setPictureSaved] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const queryClient = useQueryClient();
  const query = useApiQuery<{ profile: Profile }>(["profile"], "/api/user/profile");
  const form = useForm<Profile>({ defaultValues: { name: "", phone: "", bio: "" } });
  useEffect(() => { if (query.data?.profile) form.reset(query.data.profile); }, [query.data, form]);
  async function save(values: Profile) {
    setProfileSaved(false);
    form.clearErrors("root");
    try {
      await api.put("/api/user/profile", values);
      setProfileSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (error) {
      form.setError("root", { message: apiMessage(error) });
    }
  }
  async function uploadPicture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPictureError("");
    setPictureSaved(false);
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) return;
    const body = new FormData();
    body.append("file", file);
    try {
      await api.put("/api/user/profile/picture", body);
      setPictureSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (error) { setPictureError(apiMessage(error)); }
  }
  return <><PageHeading eyebrow="Your profile" title="Profile details" description="Help employers understand who you are and what you bring." />{query.isPending ? <LoadingCards count={1} /> : query.isError ? <ErrorState /> : <><Card className="mb-5"><h2 className="mb-4 font-bold">Profile picture</h2>{query.data?.profile.picture_url && <img className="mb-4 size-20 rounded-full border border-border object-cover" src={query.data.profile.picture_url} alt="Your profile picture" />}{pictureSaved && <div className="mb-4"><Notice tone="success">Picture updated.</Notice></div>}{pictureError && <div className="mb-4"><Notice tone="error">{pictureError}</Notice></div>}<form className="flex flex-wrap items-end gap-4" onSubmit={(event) => void uploadPicture(event)}><Field label="PNG, JPG, or WEBP"><Input type="file" name="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" required /></Field><Button>Upload picture</Button></form></Card><Card><form className="grid gap-5" onSubmit={form.handleSubmit(save)}>{profileSaved && <Notice tone="success">Profile saved.</Notice>}{form.formState.errors.root && <Notice tone="error">{form.formState.errors.root.message}</Notice>}<Field label="Full name"><Input {...form.register("name", { required: true })} /></Field><Field label="Phone"><Input type="tel" {...form.register("phone", { required: true })} /></Field><Field label="Professional bio"><textarea className="min-h-40 rounded-lg border border-border bg-background p-3 text-sm" {...form.register("bio")} /></Field><Button disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : "Save profile"}</Button></form></Card></>}</>;
}
