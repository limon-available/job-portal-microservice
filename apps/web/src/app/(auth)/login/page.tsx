import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import { PageHeading } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return <><PageHeading eyebrow="Welcome back" title="Sign in" description="Pick up where you left off." /><Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}><LoginForm /></Suspense><p className="mt-6 text-center text-sm text-muted-foreground">New to HireHeaven? <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link></p></>;
}
