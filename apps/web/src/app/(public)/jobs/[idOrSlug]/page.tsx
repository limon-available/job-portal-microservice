import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, MapPin, Building2, CalendarDays } from "lucide-react";
import { ApplyButton } from "@/components/apply-button";
import { SaveJobButton } from "@/components/save-job-button";
import { Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { z } from "zod";

interface JobRecord {
  job_id: number;
  title: string;
  slug?: string;
  description: string;
  location: string;
  job_type: string;
  salary_min?: number | null;
  salary_max?: number | null;
  deadline?: string | null;
  created_at?: string;
  company_name?: string;
  company?: { name?: string; logo_url?: string };
  skills?: Array<string | { name: string }>;
}

const jobSchema = z.object({
  job_id: z.number().int().positive(),
  title: z.string(),
  slug: z.string().optional(),
  description: z.string(),
  location: z.string(),
  job_type: z.string(),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  deadline: z.string().nullable().optional(),
  created_at: z.string().optional(),
  company_name: z.string().optional(),
  company: z.object({ name: z.string().optional(), logo_url: z.string().optional() }).optional(),
  skills: z.array(z.union([z.string(), z.object({ name: z.string() })])).optional(),
});

async function loadJob(idOrSlug: string): Promise<JobRecord | null> {
  const gateway = process.env.GATEWAY_SERVER_URL ?? process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (!gateway) throw new Error("NEXT_PUBLIC_GATEWAY_URL must be configured");
  const response = await fetch(`${gateway}/api/jobs/jobs/${encodeURIComponent(idOrSlug)}`, { next: { revalidate: 60 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not load job details (${response.status})`);
  const envelope: unknown = await response.json();
  if (typeof envelope !== "object" || envelope === null || !("data" in envelope)) return null;
  const data = envelope.data;
  if (typeof data !== "object" || data === null || !("job" in data)) return null;
  const parsedJob = jobSchema.safeParse(data.job);
  return parsedJob.success ? parsedJob.data : null;
}

export async function generateMetadata({ params }: { params: { idOrSlug: string } }): Promise<Metadata> {
  const { idOrSlug } = params;
  const job = await loadJob(idOrSlug);
  if (!job) return { title: "Job not found" };
  return {
    title: `${job.title} — ${job.company_name ?? job.company?.name ?? "HireHeaven"}`,
    description: job.description.slice(0, 160),
    openGraph: { title: job.title, description: job.description.slice(0, 160), type: "article" },
  };
}

const salary = (value?: number | null) => value == null ? undefined : new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default async function JobDetailPage({ params }: { params: { idOrSlug: string } }) {
  const { idOrSlug } = params;
  const job = await loadJob(idOrSlug);
  if (!job) notFound();
  const company = job.company_name ?? job.company?.name ?? "Hiring team";
  const title = job.title;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description: job.description,
    datePosted: job.created_at,
    ...(job.deadline ? { validThrough: job.deadline } : {}),
    employmentType: job.job_type?.toUpperCase().replaceAll("-", "_"),
    hiringOrganization: { "@type": "Organization", name: company, ...(job.company?.logo_url ? { logo: job.company.logo_url } : {}) },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location } },
    ...(job.salary_min != null || job.salary_max != null ? {
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "USD",
        value: { "@type": "QuantitativeValue", ...(job.salary_min != null ? { minValue: job.salary_min } : {}), ...(job.salary_max != null ? { maxValue: job.salary_max } : {}), unitText: "YEAR" },
      },
    } : {}),
  };
  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  return <main className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_20rem]">
    <article><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd }} /><p className="text-sm font-semibold text-primary">{company}</p><h1 className="mt-2 text-4xl font-extrabold">{title}</h1><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span className="flex items-center gap-2"><MapPin size={16} />{job.location}</span><span className="flex items-center gap-2"><BriefcaseBusiness size={16} />{job.job_type?.replaceAll("-", " ")}</span><span className="flex items-center gap-2"><CalendarDays size={16} />Posted {formatDate(job.created_at)}</span></div><Card className="mt-8"><h2 className="text-xl font-bold">About the role</h2><div className="mt-4 whitespace-pre-wrap leading-7 text-muted-foreground">{job.description}</div>{job.skills?.length ? <><h3 className="mt-8 font-bold">Skills</h3><div className="mt-3 flex flex-wrap gap-2">{job.skills.map((skill, index) => <span key={index} className="rounded-full bg-muted px-3 py-1 text-xs">{typeof skill === "string" ? skill : skill.name}</span>)}</div></> : null}</Card></article>
    <aside className="lg:sticky lg:top-24 lg:self-start"><Card><div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 /></div><h2 className="mt-4 text-xl font-bold">{company}</h2><p className="mt-1 text-sm text-muted-foreground">Join a team building what comes next.</p><div className="my-6 space-y-3 border-y border-border py-5 text-sm"><p className="flex justify-between gap-4"><span className="text-muted-foreground">Compensation</span><strong>{salary(job.salary_min) ?? "—"}{job.salary_max ? ` – ${salary(job.salary_max)}` : ""}</strong></p><p className="flex justify-between gap-4"><span className="text-muted-foreground">Apply by</span><strong>{formatDate(job.deadline)}</strong></p></div><div className="grid gap-4"><ApplyButton jobId={job.job_id} /><SaveJobButton jobId={job.job_id} /></div></Card></aside>
  </main>;
}
