"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api, apiMessage, type ApiEnvelope } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { Button, Card, Field, Input, Notice, PageHeading } from "@/components/ui";
import { EmptyState, ErrorState, LoadingCards } from "@/components/query-state";

interface ResourceItem extends Record<string, unknown> {
  id?: number | string;
  name?: string;
  title?: string;
}
export interface ResourceField {
  name: string;
  label: string;
  type?: "text" | "date" | "textarea";
  required?: boolean;
}

export function ResourceManager({
  title,
  description,
  endpoint,
  collection,
  idField,
  fields,
  itemLabel,
  deleteBody,
  allowEdit = false,
}: {
  title: string;
  description: string;
  endpoint: string;
  collection: string;
  idField: string;
  fields: ResourceField[];
  itemLabel: (item: ResourceItem) => string;
  deleteBody?: (item: ResourceItem) => Record<string, unknown>;
  allowEdit?: boolean;
}) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<ResourceItem | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const query = useApiQuery<Record<string, unknown>>([endpoint], endpoint);
  const items = (query.data?.[collection] as ResourceItem[] | undefined) ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    const form = event.currentTarget;
    const values = Object.fromEntries([...new FormData(form).entries()].filter(([, value]) => value !== ""));
    try {
      const response = editing
        ? await api.put<ApiEnvelope<unknown>>(`${endpoint}/${encodeURIComponent(String(editing[idField]))}`, values)
        : await api.post<ApiEnvelope<unknown>>(endpoint, values);
      setNotice({ text: response.data.message || `${title} saved`, error: false });
      setEditing(null);
      setEditValues({});
      form.reset();
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
    } catch (error) {
      setNotice({ text: apiMessage(error), error: true });
    } finally {
      setPending(false);
    }
  }

  async function remove(item: ResourceItem) {
    const id = item[idField];
    if (id === undefined) return;
    setPending(true);
    setNotice(null);
    try {
      if (deleteBody) await api.delete(endpoint, { data: deleteBody(item) });
      else await api.delete(`${endpoint}/${encodeURIComponent(String(id))}`);
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
    } catch (error) {
      setNotice({ text: apiMessage(error), error: true });
    } finally {
      setPending(false);
    }
  }

  function edit(item: ResourceItem) {
    setEditing(item);
    const values = Object.fromEntries(fields.map((field): [string, string] => {
      const snakeName = field.name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      const value = item[snakeName] ?? item[field.name];
      const normalized = field.type === "date" && typeof value === "string" ? value.slice(0, 10) : value;
      return [field.name, normalized == null ? "" : String(normalized)];
    }));
    setEditValues(values);
  }

  return <><PageHeading eyebrow="Your workspace" title={title} description={description} />
    {notice && <div className="mb-5"><Notice tone={notice.error ? "error" : "success"}>{notice.text}</Notice></div>}
    <Card className="mb-6"><h2 className="mb-4 font-bold">{editing ? `Edit ${title.toLowerCase().replace(/s$/, "")}` : `Add ${title.toLowerCase().replace(/s$/, "")}`}</h2><form key={String(editing?.[idField] ?? "new")} className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>{fields.map((field) => <Field key={field.name} label={field.label}><FieldInput field={field} defaultValue={editValues[field.name] ?? ""} /></Field>)}<div className="flex gap-3 sm:col-span-2"><Button disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Save"}</Button>{editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setEditValues({}); }}>Cancel</Button>}</div></form></Card>
    {query.isPending ? <LoadingCards count={2} /> : query.isError ? <ErrorState /> : items.length === 0 ? <EmptyState title={`No ${title.toLowerCase()} yet`} detail="Add your first item above to build out your profile." /> : <div className="grid gap-3">{items.map((item, index) => <Card key={String(item[idField] ?? index)} className="flex items-start justify-between gap-4"><div><h3 className="font-bold">{itemLabel(item)}</h3><p className="mt-1 text-sm text-muted-foreground">{String(item.description ?? item.field_of_study ?? "")}</p></div><div className="flex gap-1">{allowEdit && <Button type="button" variant="ghost" disabled={pending} onClick={() => edit(item)}>Edit</Button>}<Button type="button" variant="ghost" aria-label={`Delete ${itemLabel(item)}`} disabled={pending} onClick={() => void remove(item)}><Trash2 size={17} /></Button></div></Card>)}</div>}
  </>;
}

function FieldInput({ field, defaultValue }: { field: ResourceField; defaultValue: string }) {
  if (field.type === "textarea") return <textarea name={field.name} defaultValue={defaultValue} required={field.required} className="min-h-24 rounded-lg border border-border bg-background p-3 text-sm" />;
  return <Input name={field.name} type={field.type ?? "text"} defaultValue={defaultValue} required={field.required} />;
}
