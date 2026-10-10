"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, apiMessage } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { Button, Card, PageHeading } from "@/components/ui";
import { EmptyState, ErrorState, LoadingCards } from "@/components/query-state";
import { formatDate } from "@/lib/utils";

interface Notification { notification_id: number; title: string; message: string; is_read: boolean; created_at: string }

export function NotificationsList() {
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const query = useApiQuery<{ notifications: Notification[] }>(["notifications"], "/api/notifications");
  async function markRead(id?: number) {
    setMessage("");
    try {
      await api.patch(id ? `/api/notifications/${id}/read` : "/api/notifications/read-all");
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error) { setMessage(apiMessage(error)); }
  }
  return <><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><PageHeading eyebrow="Stay in the loop" title="Notifications" description="Updates about your applications and account." /><Button variant="outline" onClick={() => void markRead()}>Mark all as read</Button></div>{message && <div className="mb-4"><Notice tone="error">{message}</Notice></div>}{query.isPending ? <LoadingCards /> : query.isError ? <ErrorState /> : query.data?.notifications.length ? <div className="grid gap-3">{query.data.notifications.map((item) => <Card key={item.notification_id} className={item.is_read ? "opacity-70" : "border-primary/40"}><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold">{item.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.message}</p><p className="mt-2 text-xs text-muted-foreground">{formatDate(item.created_at)}</p></div>{!item.is_read && <Button variant="ghost" onClick={() => void markRead(item.notification_id)}>Mark read</Button>}</div></Card>)}</div> : <EmptyState title="You're all caught up" detail="New updates will show up here." />}</>;
}
