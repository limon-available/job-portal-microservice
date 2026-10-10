"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, SlidersHorizontal, MapPin, BriefcaseBusiness, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { Card, Input, Button, Field } from "@/components/ui";
import { ErrorState, LoadingCards, EmptyState } from "@/components/query-state";

interface Job {
  job_id: number; title: string; slug: string; location: string; job_type: string;
  description: string; salary_min?: number | null; salary_max?: number | null;
  created_at?: string; company_name?: string; company?: { name?: string };
}
interface JobResults { jobs: Job[]; meta: { total: number; page: number; totalPages: number } }

const money = (value?: number | null) => value == null ? null : new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function JobSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [keyword, setKeyword] = useState(params.get("keyword") ?? "");
  const [location, setLocation] = useState(params.get("location") ?? "");
  const [jobType, setJobType] = useState(params.get("jobType") ?? "");
  const [skills, setSkills] = useState(params.get("skills") ?? "");
  const [salaryMin, setSalaryMin] = useState(params.get("salaryMin") ?? "");
  const [salaryMax, setSalaryMax] = useState(params.get("salaryMax") ?? "");
  const [sort, setSort] = useState(params.get("sort") ?? "newest");
  const query = Object.fromEntries(params.entries());
  const jobsQuery = useApiQuery<JobResults>(["jobs"], "/api/jobs/jobs", { ...query, limit: 12 });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (keyword.trim()) next.set("keyword", keyword.trim());
    if (location.trim()) next.set("location", location.trim());
    if (jobType) next.set("jobType", jobType);
    if (skills.trim()) next.set("skills", skills.trim());
    if (salaryMin) next.set("salaryMin", salaryMin);
    if (salaryMax) next.set("salaryMax", salaryMax);
    if (sort !== "newest") next.set("sort", sort);
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  };
  const setPage = (page: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(page));
    router.push(`${pathname}?${next}`);
  };
  return <div>
    <header className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Find your fit</p><h1 className="mt-2 text-4xl font-extrabold">Explore opportunities</h1><p className="mt-2 text-muted-foreground">The right next step is closer than you think.</p></header>
    <form onSubmit={submit} className="mb-8 grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:grid-cols-3 xl:grid-cols-7">
      <Field label="Keywords"><div className="relative"><Search className="absolute left-3 top-3 text-muted-foreground" size={17} /><Input className="pl-10" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Title or company" /></div></Field>
      <Field label="Location"><div className="relative"><MapPin className="absolute left-3 top-3 text-muted-foreground" size={17} /><Input className="pl-10" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City or remote" /></div></Field>
      <Field label="Job type"><select className="h-11 rounded-lg border border-border bg-background px-3 text-sm" value={jobType} onChange={(event) => setJobType(event.target.value)}><option value="">Any type</option>{["full-time", "part-time", "contract", "internship", "temporary", "remote"].map((value) => <option key={value} value={value}>{value.replace("-", " ")}</option>)}</select></Field>
      <Field label="Skills"><div className="relative"><SlidersHorizontal className="absolute left-3 top-3 text-muted-foreground" size={17} /><Input className="pl-10" value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="e.g. React, design" /></div></Field>
      <Field label="Min. salary"><Input type="number" min="0" value={salaryMin} onChange={(event) => setSalaryMin(event.target.value)} placeholder="Any" /></Field>
      <Field label="Max. salary"><Input type="number" min="0" value={salaryMax} onChange={(event) => setSalaryMax(event.target.value)} placeholder="Any" /></Field>
      <Field label="Sort by"><select className="h-11 rounded-lg border border-border bg-background px-3 text-sm" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="salary_asc">Salary: low to high</option><option value="salary_desc">Salary: high to low</option></select></Field>
      <Button className="self-end"><Search size={16} /> Search</Button>
    </form>
    <div className="mb-4 flex justify-between text-sm text-muted-foreground"><span>{jobsQuery.data?.meta.total ?? "—"} opportunities</span><span>Sorted by {sort.replaceAll("_", " ")}</span></div>
    {jobsQuery.isPending ? <LoadingCards /> : jobsQuery.isError ? <ErrorState /> : jobsQuery.data?.jobs.length ? <div className="grid gap-4 lg:grid-cols-2">{jobsQuery.data.jobs.map((job) => <Link key={job.job_id} href={`/jobs/${encodeURIComponent(job.slug || String(job.job_id))}`} className="group"><Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-primary/50"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-primary">{job.company_name ?? job.company?.name ?? "Hiring team"}</p><h2 className="mt-1 text-xl font-bold group-hover:text-primary">{job.title}</h2></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold capitalize">{job.job_type?.replace("-", " ")}</span></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{job.description}</p><div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin size={14} />{job.location}</span><span className="flex items-center gap-1"><BriefcaseBusiness size={14} />{money(job.salary_min) ?? "Salary"}{job.salary_max ? ` – ${money(job.salary_max)}` : ""}</span></div></Card></Link>)}</div> : <EmptyState title="No jobs found" detail="Try adjusting your filters or search for a different role." />}
    {jobsQuery.data && jobsQuery.data.meta.totalPages > 1 && <div className="mt-8 flex items-center justify-center gap-3"><Button variant="outline" disabled={jobsQuery.data.meta.page <= 1} onClick={() => setPage(jobsQuery.data!.meta.page - 1)}><ChevronLeft size={16} /> Previous</Button><span className="text-sm text-muted-foreground">Page {jobsQuery.data.meta.page} of {jobsQuery.data.meta.totalPages}</span><Button variant="outline" disabled={jobsQuery.data.meta.page >= jobsQuery.data.meta.totalPages} onClick={() => setPage(jobsQuery.data!.meta.page + 1)}>Next <ChevronRight size={16} /></Button></div>}
  </div>;
}
