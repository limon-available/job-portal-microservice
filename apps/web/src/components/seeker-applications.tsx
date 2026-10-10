"use client";

import Link from "next/link";
import { useState } from "react";
import { api, apiMessage } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { Card, PageHeading, Button, Notice } from "@/components/ui";
import { EmptyState, ErrorState, LoadingCards } from "@/components/query-state";
import { formatDate } from "@/lib/utils";

interface Application {
  application_id: number;
  job_id: number;
  status: string;
  applied_at: string;
  job_title?: string;
  company_name?: string;
  title?: string;
}

export function SeekerApplications() {
  const [message, setMessage] = useState("");
  const query = useApiQuery<{ applications: Application[] }>(["applications"], "/api/applications/mine");
  async function withdraw(id: number) {
    setMessage("");
    try {
      await api.delete(`/api/applications/${id}`);
      await query.refetch();
    } catch (error) { setMessage(apiMessage(error)); }
  }
  return <><PageHeading eyebrow="Your job search" title="Applications" description="Follow each application from submitted to decision." />{message && <div className="mb-4"><Notice tone="error">{message}</Notice></div>}{query.isPending ? <LoadingCards /> : query.isError ? <ErrorState /> : query.data?.applications.length ? <div className="grid gap-3">{query.data.applications.map((item) => <Card key={item.application_id} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><Link href={`/jobs/${item.job_id}`} className="font-bold hover:text-primary">{item.job_title ?? item.title ?? `Job #${item.job_id}`}</Link><p className="mt-1 text-sm text-muted-foreground">{item.company_name ?? "Hiring team"} · Applied {formatDate(item.applied_at)}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold capitalize">{item.status}</span>{["applied", "shortlisted", "interview"].includes(item.status) && <Button type="button" variant="outline" onClick={() => void withdraw(item.application_id)}>Withdraw</Button>}</div></Card>)}</div> : <EmptyState title="No applications yet" detail="Explore open jobs and apply to roles that feel right." />}</>;
}
