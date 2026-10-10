import { Suspense } from "react";
import { VerifyEmailPage } from "@/components/verify-email-page";
import { PageHeading } from "@/components/ui";

export const metadata = { title: "Verify your email" };

export default function VerifyEmailRoute() {
  return <><PageHeading eyebrow="One last step" title="Verify your email" description="Confirm your address to finish setting up your account." /><Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}><VerifyEmailPage /></Suspense></>;
}
