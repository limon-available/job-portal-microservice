"use client";

import { useState, type FormEvent } from "react";
import { api, apiMessage } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { Button, Card, Field, Input, Notice, PageHeading } from "@/components/ui";

interface Company { company_id: number; name: string; website?: string | null; description?: string; location?: string | null; logo_url?: string | null }

export function CompanyProfile() {
  const query = useApiQuery<{ companies: Company[] }>(["companies"], "/api/jobs/companies");
  const [companyId, setCompanyId] = useState<number | "">("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const company = query.data?.companies.find((candidate) => candidate.company_id === companyId);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries([...new FormData(event.currentTarget).entries()].filter(([, value]) => value !== ""));
    setBusy(true); setError(""); setNotice("");
    try {
      if (companyId) await api.put(`/api/jobs/companies/${companyId}`, body);
      else await api.post("/api/jobs/companies", body);
      setNotice("Company profile saved.");
      await query.refetch();
    } catch (caught) {
      setError(apiMessage(caught));
    } finally { setBusy(false); }
  }
  async function uploadLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyId) return;
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || !file.size) return;
    const body = new FormData(); body.append("file", file);
    setBusy(true); setError("");
    try {
      await api.put(`/api/jobs/companies/${companyId}/logo`, body);
      setNotice("Company logo updated.");
      await query.refetch();
    } catch (caught) { setError(apiMessage(caught)); } finally { setBusy(false); }
  }
  return <><PageHeading eyebrow="Your organization" title="Company profile" description="Give candidates a clear picture of the team behind your openings." />{error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}{notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}
    <div className="mb-5 max-w-sm"><Field label="Edit existing company (optional)"><select className="h-11 w-full rounded-lg border border-border bg-background px-3" value={companyId} onChange={(event) => setCompanyId(event.target.value ? Number(event.target.value) : "")}><option value="">Create a new company</option>{query.data?.companies.map((item) => <option key={item.company_id} value={item.company_id}>{item.name}</option>)}</select></Field></div>
    <Card className="max-w-3xl"><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void save(event)}><Field label="Company name"><Input name="name" required defaultValue={company?.name ?? ""} key={`name-${company?.company_id ?? "new"}`} /></Field><Field label="Website"><Input name="website" type="url" placeholder="https://example.com" defaultValue={company?.website ?? ""} key={`website-${company?.company_id ?? "new"}`} /></Field><Field label="Location"><Input name="location" defaultValue={company?.location ?? ""} key={`location-${company?.company_id ?? "new"}`} /></Field><Field label="About the company"><textarea name="description" className="min-h-24 rounded-lg border border-border bg-background p-3 text-sm" defaultValue={company?.description ?? ""} key={`description-${company?.company_id ?? "new"}`} /></Field><div className="sm:col-span-2"><Button disabled={busy}>{company ? "Save company" : "Create company"}</Button></div></form></Card>
    {company && <Card className="mt-5 max-w-3xl"><h2 className="font-bold">Company logo</h2>{company.logo_url && <img className="my-4 size-20 rounded-xl border border-border object-cover" src={company.logo_url} alt={`${company.name} logo`} />}<form className="mt-4 flex flex-wrap items-end gap-4" onSubmit={(event) => void uploadLogo(event)}><Field label="PNG, JPG, or WEBP"><Input type="file" name="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" required /></Field><Button disabled={busy}>Upload logo</Button></form></Card>}
  </>;
}
