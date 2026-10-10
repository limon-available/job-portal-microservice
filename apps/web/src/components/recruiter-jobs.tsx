"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { api, apiMessage } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { Button, Card, Notice, PageHeading } from "@/components/ui";
import { EmptyState, ErrorState, LoadingCards } from "@/components/query-state";
import { formatDate } from "@/lib/utils";

interface JobItem { job_id: number; title: string; status: string; location: string; created_at?: string; views?: number }

export function RecruiterJobs() {
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const query = useApiQuery<{ jobs: JobItem[] }>(["my-jobs"], "/api/jobs/jobs/mine");
  async function updateStatus(job: JobItem, status: "open" | "closed" | "draft") {
    setMessage("");
    try {
      await api.patch(`/api/jobs/jobs/${job.job_id}/status`, { status });
      await client.invalidateQueries({ queryKey: ["my-jobs"] });
    } catch (error) {
      setMessage(apiMessage(error));
    }
  }
  async function remove(job: JobItem) {
    if (!window.confirm(`Delete “${job.title}”?`)) return;
    try {
      await api.delete(`/api/jobs/jobs/${job.job_id}`);
      await client.invalidateQueries({ queryKey: ["my-jobs"] });
    } catch (error) { window.alert(apiMessage(error)); }
  }
  return <><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><PageHeading eyebrow="Recruiting" title="Manage jobs" description="Keep your open roles current and review applicants." /><Link href="/recruiter/jobs/new" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Post a job</Link></div>
    {message && <div className="mb-4"><Notice tone="error">{message}</Notice></div>}
    {query.isPending ? <LoadingCards /> : query.isError ? <ErrorState /> : query.data?.jobs.length ? <div className="grid gap-3">{query.data.jobs.map((job) => <Card key={job.job_id}><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><h2 className="text-lg font-bold">{job.title}</h2><p className="mt-1 text-sm text-muted-foreground">{job.location} · Updated {formatDate(job.created_at)} · {job.views ?? 0} views</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold capitalize">{job.status}</span><Link href={`/recruiter/jobs/${job.job_id}/applicants`} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">Applicants</Link><Link href={`/recruiter/jobs/${job.job_id}/edit`} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">Edit</Link>{job.status === "open" ? <Button variant="outline" onClick={() => void updateStatus(job, "closed")}>Close</Button> : job.status !== "expired" && <Button variant="outline" onClick={() => void updateStatus(job, "open")}>Open</Button>}<Button variant="ghost" onClick={() => void remove(job)}>Delete</Button></div></div></Card>)}</div> : <EmptyState title="No jobs posted" detail="Create your first role and start meeting candidates." />}
  </>;
}

export function ApplicantTable({ jobId }: { jobId: number }) {
  const query = useApiQuery<{ applications: Applicant[] }>(["applicants", jobId], `/api/applications/job/${jobId}`);
  const [message, setMessage] = useState("");
  async function setStatus(applicant: Applicant, status: "shortlisted" | "interview" | "hired" | "rejected") {
    setMessage("");
    try {
      await api.patch(`/api/applications/${applicant.application_id}/status`, { status });
      await query.refetch();
    } catch (error) { setMessage(apiMessage(error)); }
  }
  const actions: Record<string, Array<"shortlisted" | "interview" | "hired" | "rejected">> = {
    applied: ["shortlisted"],
    shortlisted: ["interview"],
    interview: ["hired", "rejected"],
  };
  return <><PageHeading eyebrow="Hiring" title="Applicants" description={`Review candidate applications for job #${jobId}.`} />{message && <div className="mb-4"><Notice tone="error">{message}</Notice></div>}{query.isPending ? <LoadingCards /> : query.isError ? <ErrorState /> : query.data?.applications.length ? <Card className="overflow-x-auto p-0"><table className="w-full min-w-[700px] border-collapse text-left text-sm"><thead className="bg-muted text-xs uppercase text-muted-foreground"><tr>{["Candidate", "Applied", "Status", "Resume", "Next action"].map((label) => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{query.data.applications.map((applicant) => <tr className="border-t border-border" key={applicant.application_id}><td className="px-4 py-4"><p className="font-semibold">{applicant.applicant_name ?? `Candidate #${applicant.user_id}`}</p><p className="text-xs text-muted-foreground">{applicant.applicant_email ?? ""}</p></td><td className="px-4 py-4">{formatDate(applicant.applied_at)}</td><td className="px-4 py-4 capitalize">{applicant.status}</td><td className="px-4 py-4">{applicant.resume_url ? <a className="text-primary underline" href={applicant.resume_url} target="_blank" rel="noreferrer">View resume</a> : "—"}</td><td className="px-4 py-4"><div className="flex gap-2">{(actions[applicant.status] ?? []).map((status) => <Button key={status} className="min-h-8 px-3 py-1 text-xs capitalize" onClick={() => void setStatus(applicant, status)}>{status}</Button>)}</div></td></tr>)}</tbody></table></Card> : <EmptyState title="No applicants yet" detail="When candidates apply, you can review them here." />}</>;
}

interface Applicant { application_id: number; user_id: number; applicant_name?: string; applicant_email?: string; status: string; applied_at: string; resume_url?: string | null }
