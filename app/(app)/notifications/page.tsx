"use client";
import { useState } from "react";
import { Check, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { useApiMutation, useList } from "@/hooks/use-api";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";

interface Note { id: string; title: string; message: string; read: boolean; type: string; createdAt: string }

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const list = useList<Note>("/notifications", { page, pageSize: 20, unread: unread ? "true" : undefined });
  const markOne = useApiMutation({ run: (n: Note) => api(`/notifications/${n.id}`, { method: "PATCH", json: { read: !n.read } }), invalidate: ["/notifications"] });
  const markAll = useApiMutation({ run: () => api("/notifications", { method: "POST" }), invalidate: ["/notifications"], success: "All notifications marked as read" });
  return (
    <>
      <PageHeader title="Notifications" description="Appointments, prescriptions, invoices and payments that concern you."
        actions={<><Button variant="secondary" onClick={() => { setUnread(!unread); setPage(1); }} aria-pressed={unread}>{unread ? "Show all" : "Unread only"}</Button><Button variant="secondary" onClick={() => markAll.mutate(undefined)} loading={markAll.isPending}><CheckCheck className="h-4 w-4" />Mark all read</Button></>} />
      <Card>
        {list.isLoading && <div className="space-y-3 p-5"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>}
        {list.error && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}
        {list.rows?.length === 0 && <EmptyState title={unread ? "You are all caught up" : "No notifications yet"} />}
        <ul className="divide-y divide-line">
          {list.rows?.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-4">
              <div>
                <p className="flex items-center gap-2 font-bold">{n.title}{!n.read && <Badge tone="primary">new</Badge>}</p>
                <p>{n.message}</p>
                <p className="text-sm text-muted">{formatDateTime(n.createdAt)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => markOne.mutate(n)}><Check className="h-4 w-4" />{n.read ? "Mark unread" : "Mark read"}</Button>
            </li>
          ))}
        </ul>
        {list.meta && list.meta.totalPages > 1 && (
          <div className="flex justify-between border-t border-line p-4"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="secondary" size="sm" disabled={page >= list.meta.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div>
        )}
      </Card>
    </>
  );
}
