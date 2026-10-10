import { Suspense } from "react";
import { JobSearch } from "@/components/job-search";

export const metadata = { title: "Find jobs" };

export default function JobsPage() {
  return <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}><JobSearch /></Suspense></main>;
}
