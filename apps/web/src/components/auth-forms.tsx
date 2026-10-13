"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { api, apiMessage } from "@/lib/api";
import { useAuthStore, type SessionUser } from "@/lib/auth-store";
import { Button, Field, Input, Notice } from "@/components/ui";



const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  email: z.string().trim().email(),
  password: z.string().min(8, "Use at least 8 characters"),
  phoneNumber: z.string().trim().min(1),
  role: z.enum(["jobseeker", "recruiter"]),
  bio: z.string().trim().min(1, "Tell us a little about yourself"),
});
type RegisterValues = z.infer<typeof registerSchema>;

function destination(role: string): string {
  if (role === "recruiter") return "/recruiter";
  if (role === "admin") return "/admin";
  return "/seeker";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof loginSchema>) => (await api.post("/api/auth/login", values)).data.data,
    onSuccess: (data: { accessToken: string; user: SessionUser }) => {
      setSession(data.accessToken, data.user);
      const next = searchParams.get("next");
      const allowed = next?.startsWith("/") && !next.startsWith("//") ? next : destination(data.user.role);
      router.replace(allowed);
      router.refresh();
    },
  });
  return <form className="grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
    {searchParams.get("registered") && <Notice tone="success">Account created. Check your inbox to verify your email, then sign in.</Notice>}
    {searchParams.get("reset") && <Notice tone="success">Password changed successfully. Sign in with your new password.</Notice>}
    {mutation.isError && <Notice tone="error">{apiMessage(mutation.error)}</Notice>}
    <Field label="Email"><Input type="email" autoComplete="email" {...form.register("email")} />{form.formState.errors.email && <small className="text-red-600">{form.formState.errors.email.message}</small>}</Field>
    <Field label="Password"><Input type="password" autoComplete="current-password" {...form.register("password")} />{form.formState.errors.password && <small className="text-red-600">{form.formState.errors.password.message}</small>}</Field>
    <div className="-mt-2 text-right"><a className="text-sm font-medium text-primary hover:underline" href="/forgot">Forgot password?</a></div>
    <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Signing in…" : "Sign in"}</Button>
  </form>;
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [resume, setResume] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "", email: "", password: "", phoneNumber: "",
      role: searchParams.get("role") === "recruiter" ? "recruiter" : "jobseeker", bio: "",
    },
  });
  const role = form.watch("role");
  const mutation = useMutation({
    mutationFn: async (values: RegisterValues) => {
      if (values.role === "jobseeker" && !resume) throw new Error("Choose a resume PDF, DOC, or DOCX file.");
      const body = new FormData();
      Object.entries(values).forEach(([key, value]) => body.append(key, value));
      body.append("acceptedTerms", String(acceptedTerms));
      if (resume) body.append("file", resume);
      return (await api.post("/api/auth/register", body)).data.data;
    },
    onSuccess: () => router.replace("/login?registered=1"),
  });
  return <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
    {mutation.isError && <Notice tone="error">{apiMessage(mutation.error)}</Notice>}
    <Field label="I am joining as"><select className="h-11 rounded-lg border border-border bg-background px-3 text-sm" {...form.register("role")}><option value="jobseeker">Job seeker</option><option value="recruiter">Recruiter</option></select></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name"><Input autoComplete="name" {...form.register("name")} /></Field>
      <Field label="Phone"><Input autoComplete="tel" {...form.register("phoneNumber")} /></Field>
    </div>
    <Field label="Email"><Input type="email" autoComplete="email" {...form.register("email")} /></Field>
    <Field label="Password"><Input type="password" autoComplete="new-password" {...form.register("password")} />{form.formState.errors.password && <small className="text-red-600">{form.formState.errors.password.message}</small>}</Field>
    <Field label={role === "jobseeker" ? "Professional bio" : "About you / your organization"}><textarea className="min-h-24 rounded-lg border border-border bg-background p-3 text-sm" {...form.register("bio")} /></Field>
    {role === "jobseeker" && <Field label="Resume (PDF, DOC, DOCX)"><Input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setResume(event.target.files?.[0] ?? null)} /></Field>}

    <div className="flex items-start gap-2 text-sm">
      <input
        id="accept-terms"
        type="checkbox"
        checked={acceptedTerms}
        onChange={(event) =>
          setAcceptedTerms(event.target.checked)
        }
        className="mt-1 h-4 w-4 border border-gray-400 bg-white rounded border-border text-primary focus:ring-primary accent-primary"
      />

      <label htmlFor="accept-terms">
        I agree to the{" "}
        <Link href="/terms" className="text-primary underline">
          Terms & Conditions
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-primary underline">
          Privacy Policy
        </Link>
        .
      </label>
    </div>

    {!acceptedTerms && (
      <p className="text-xs text-muted-foreground">
        Please accept the Terms & Conditions to continue.
      </p>
    )}
    <Button type="submit" disabled={mutation.isPending || !acceptedTerms}>{mutation.isPending ? "Creating account…" : "Create account"}</Button>
  </form>;
}

export function ForgotForm() {
  const form = useForm({ resolver: zodResolver(z.object({ email: z.string().email() })), defaultValues: { email: "" } });
  const mutation = useMutation({ mutationFn: async (values: { email: string }) => (await api.post("/api/auth/forgot", values)).data });
  return <form className="grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
    {mutation.isSuccess ? <Notice tone="success">If an account exists for this address, reset instructions are on their way.</Notice> : <>
      {mutation.isError && <Notice tone="error">{apiMessage(mutation.error)}</Notice>}
      <Field label="Email"><Input type="email" autoComplete="email" {...form.register("email")} /></Field>
      <Button disabled={mutation.isPending}>{mutation.isPending ? "Sending…" : "Send reset link"}</Button>
    </>}
  </form>;
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const form = useForm({ resolver: zodResolver(z.object({ password: z.string().min(8) })), defaultValues: { password: "" } });
  const mutation = useMutation({
    mutationFn: async (values: { password: string }) => api.post(`/api/auth/reset/${encodeURIComponent(token)}`, values),
    onSuccess: () => router.replace("/login?reset=1"),
  });
  return <form className="grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
    {mutation.isSuccess && <Notice tone="success">Password updated. You can sign in with your new password.</Notice>}
    {mutation.isError && <Notice tone="error">{apiMessage(mutation.error)}</Notice>}
    {!mutation.isSuccess && <><Field label="New password"><Input type="password" autoComplete="new-password" {...form.register("password")} /></Field><Button disabled={mutation.isPending}>Update password</Button></>}
  </form>;
}

export function VerifyEmail({ token }: { token: string }) {
  const [message, setMessage] = useState("Verifying your email…");
  useEffect(() => {
    let active = true;
    api.get(`/api/auth/verify-email/${encodeURIComponent(token)}`)
      .then(() => { if (active) setMessage("Email verified. You can now sign in."); })
      .catch((error: unknown) => { if (active) setMessage(apiMessage(error)); });
    return () => { active = false; };
  }, [token]);
  return <Notice>{message}</Notice>;
}
