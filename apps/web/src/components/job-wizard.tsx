"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, apiMessage } from "@/lib/api";
import { Button, Card, Field, Input, Notice, PageHeading } from "@/components/ui";

const schema = z.object({
  title: z.string().trim().min(1),
  location: z.string().trim().min(1),
  jobType: z.enum(["full-time", "part-time", "contract", "internship", "temporary", "remote"]),
  companyId: z.coerce.number().int().positive(),
  description: z.string().trim().min(1),
  salaryMin: z.string().optional(),
  salaryMax: z.string().optional(),
  experienceYears: z.coerce.number().int().min(0).max(60),
  deadline: z.string().optional(),
  status: z.enum(["draft", "open"]),
  skills: z.string().optional(),
});
type Values = z.infer<typeof schema>;
interface Company { company_id: number; name: string }
interface Job { job_id: number; title: string; location: string; job_type: string; company_id: number; description: string; salary_min?: number | null; salary_max?: number | null; experience_years: number; deadline?: string | null; status: "draft" | "open"; skills?: Array<string | { name: string }> }
interface Envelope<T> { data: T }

export function JobWizard({ jobId }: { jobId?: number }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [job, setJob] = useState<Job | null>(null);
  const [loadError, setLoadError] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", location: "", jobType: "full-time", companyId: 0, description: "", salaryMin: "", salaryMax: "", experienceYears: 0, deadline: "", status: "draft", skills: "" },
  });
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<Envelope<{ companies: Company[] }>>("/api/jobs/companies"),
      jobId ? api.get<Envelope<{ jobs: Job[] }>>("/api/jobs/jobs/mine") : Promise.resolve(null),
    ]).then(([companyResponse, jobsResponse]) => {
      if (!active) return;
      const ownedCompanies = companyResponse.data.data.companies;
      setCompanies(ownedCompanies);
      const selectedJob = jobsResponse?.data.data.jobs.find((candidate) => candidate.job_id === jobId);
      if (selectedJob) {
        setJob(selectedJob);
        form.reset({
          title: selectedJob.title,
          location: selectedJob.location,
          jobType: selectedJob.job_type as Values["jobType"],
          companyId: selectedJob.company_id,
          description: selectedJob.description,
          salaryMin: selectedJob.salary_min == null ? "" : String(selectedJob.salary_min),
          salaryMax: selectedJob.salary_max == null ? "" : String(selectedJob.salary_max),
          experienceYears: selectedJob.experience_years,
          deadline: selectedJob.deadline?.slice(0, 10) ?? "",
          status: selectedJob.status === "open" ? "open" : "draft",
          skills: selectedJob.skills?.map((skill) => typeof skill === "string" ? skill : skill.name).join(", ") ?? "",
        });
      } else if (jobId) {
        setLoadError("Job not found in your listings.");
      } else if (ownedCompanies[0]) {
        form.setValue("companyId", ownedCompanies[0].company_id);
      }
    }).catch((error: unknown) => { if (active) setLoadError(apiMessage(error)); });
    return () => { active = false; };
  }, [jobId, form]);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const body = {
        ...values,
        salaryMin: values.salaryMin ? Number(values.salaryMin) : null,
        salaryMax: values.salaryMax ? Number(values.salaryMax) : null,
        deadline: values.deadline || null,
        skills: values.skills?.split(",").map((skill) => skill.trim()).filter(Boolean) ?? [],
      };
      return jobId
        ? api.put(`/api/jobs/jobs/${jobId}`, body)
        : api.post("/api/jobs/jobs", body);
    },
    onSuccess: () => router.push("/recruiter/jobs"),
  });
  const stepFields: Array<Array<keyof Values>> = [["title", "location", "jobType", "companyId"], ["description", "skills"], ["salaryMin", "salaryMax", "experienceYears", "deadline", "status"]];
  async function next() {
    const valid = await form.trigger(stepFields[step]);
    if (valid) setStep((current) => Math.min(2, current + 1));
  }
  return <><PageHeading eyebrow={jobId ? "Manage roles" : "Recruiting"} title={jobId ? "Edit job" : "Post a job"} description="A few simple steps to help the right people find this role." /><div className="mb-5 flex gap-2">{["The role", "Description", "Details"].map((label, index) => <div key={label} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`} aria-label={`Step ${index + 1}: ${label}`} />)}</div>{loadError && <div className="mb-4"><Notice tone="error">{loadError}</Notice></div>}{!companies.length && !loadError && <div className="mb-4"><Notice tone="error">Add a company profile before creating a job.</Notice></div>}
    <Card><form className="grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      {mutation.isError && <Notice tone="error">{apiMessage(mutation.error)}</Notice>}
      {step === 0 && <><Field label="Job title"><Input {...form.register("title")} placeholder="Senior product designer" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Location"><Input {...form.register("location")} placeholder="Remote / New York" /></Field><Field label="Job type"><select className="h-11 rounded-lg border border-border bg-background px-3" {...form.register("jobType")}>{["full-time", "part-time", "contract", "internship", "temporary", "remote"].map((type) => <option key={type} value={type}>{type.replace("-", " ")}</option>)}</select></Field></div><Field label="Hiring company"><select className="h-11 rounded-lg border border-border bg-background px-3" {...form.register("companyId", { valueAsNumber: true })}><option value={0}>Choose a company</option>{companies.map((company) => <option key={company.company_id} value={company.company_id}>{company.name}</option>)}</select></Field></>}
      {step === 1 && <><Field label="Role description"><textarea className="min-h-64 rounded-lg border border-border bg-background p-3" {...form.register("description")} placeholder="What will this person do? What does success look like?" /></Field><Field label="Skills (comma separated)"><Input {...form.register("skills")} placeholder="Product strategy, Figma, research" /></Field></>}
      {step === 2 && <><div className="grid gap-4 sm:grid-cols-2"><Field label="Minimum salary (USD/year)"><Input type="number" min="0" {...form.register("salaryMin")} /></Field><Field label="Maximum salary (USD/year)"><Input type="number" min="0" {...form.register("salaryMax")} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Experience (years)"><Input type="number" min="0" max="60" {...form.register("experienceYears")} /></Field><Field label="Application deadline"><Input type="date" {...form.register("deadline")} /></Field></div><Field label="Publish status"><select className="h-11 rounded-lg border border-border bg-background px-3" {...form.register("status")}><option value="draft">Save as draft</option><option value="open">Publish job</option></select></Field></>}
      <div className="flex justify-between border-t border-border pt-4">{step > 0 ? <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)}>Back</Button> : <span />}{step < 2 ? <Button type="button" onClick={() => void next()}>Continue</Button> : <Button disabled={mutation.isPending || !companies.length}>{mutation.isPending ? "Saving…" : job ? "Save changes" : "Create job"}</Button>}</div>
    </form></Card>
  </>;
}
