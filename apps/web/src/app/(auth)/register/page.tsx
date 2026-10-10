import Link from "next/link";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";
import { PageHeading } from "@/components/ui";

export const metadata = { title: "Create your account" };

export default function RegisterPage() {
  return <><PageHeading eyebrow="Join HireHeaven" title="Create an account" description="A few details are all it takes to get started." /><Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}><RegisterForm /></Suspense><p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p></>;
}
