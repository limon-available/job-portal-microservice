import { LoadingCards } from "@/components/query-state";

export default function Loading() {
  return <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="mb-8 h-10 w-2/5 animate-pulse rounded bg-muted" /><LoadingCards count={3} /></main>;
}
