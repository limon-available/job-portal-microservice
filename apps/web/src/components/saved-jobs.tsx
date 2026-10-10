"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api, apiMessage } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { Button, Card, Notice, PageHeading } from "@/components/ui";
import { EmptyState, ErrorState, LoadingCards } from "@/components/query-state";
import { formatDate } from "@/lib/utils";

interface SavedJob { job_id: string | number; created_at: string }

export function SavedJobs() {
  const [message, setMessage] = useState("");
  const query = useApiQuery<{ savedJobs: SavedJob[] }>(["saved-jobs"], "/api/user/saved-jobs");
  async function remove(jobId: string | number) {
    setMessage("");
    try {
      await api.delete(`/api/user/saved-jobs/${encodeURIComponent(String(jobId))}`);
      await query.refetch();
    } catch (error) { setMessage(apiMessage(error)); }
  }
  return <><PageHeading eyebrow="Keep exploring" title="Saved jobs" description="A short list of opportunities you want to revisit." />{message && <div className="mb-4"><Notice tone="error">{message}</Notice></div>}{query.isPending ? <LoadingCards /> : query.isError ? <ErrorState /> : query.data?.savedJobs.length ? <div className="grid gap-3">{query.data.savedJobs.map((job) => <Card key={job.job_id} className="flex items-center justify-between gap-4"><div><Link className="font-bold hover:text-primary" href={`/jobs/${job.job_id}`}>View saved opportunity</Link><p className="mt-1 text-sm text-muted-foreground">Saved {formatDate(job.created_at)}</p></div><Button variant="ghost" aria-label="Remove saved job" onClick={() => void remove(job.job_id)}><Trash2 size={17} /></Button></Card>)}</div> : <EmptyState title="Nothing saved yet" detail="Save jobs from search results to keep them close at hand." />}</>;
}
