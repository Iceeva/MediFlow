"use client";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useList } from "@/hooks/use-api";
import { formatDateTime, fullName } from "@/lib/utils";

interface Entry { id: string; action: string; resource: string; resourceId: string | null; result: string; ip: string | null; createdAt: string; user: { firstName: string; lastName: string; email: string } | null }

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [result, setResult] = useState("");
  const list = useList<Entry>("/audit", { page, action, resource, result, pageSize: 25 });
  return (
    <>
      <PageHeader title="Audit log" description="Who did what, and when. Entries cannot be edited or deleted." />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <Input aria-label="Filter by action" placeholder="Action, e.g. patient.view" className="max-w-xs" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
          <Select aria-label="Resource" className="max-w-44" value={resource} onChange={(e) => { setResource(e.target.value); setPage(1); }}><option value="">Any resource</option>{["patient", "appointment", "consultation", "prescription", "document", "invoice", "payment", "user", "session"].map((r) => <option key={r}>{r}</option>)}</Select>
          <Select aria-label="Result" className="max-w-40" value={result} onChange={(e) => { setResult(e.target.value); setPage(1); }}><option value="">Any result</option><option value="SUCCESS">Success</option><option value="DENIED">Denied</option><option value="FAILURE">Failure</option></Select>
        </div>
        <DataTable<Entry> rows={list.rows} loading={list.isLoading} error={list.error} meta={list.meta} onPage={setPage} onRetry={() => list.refetch()} empty={{ title: "No matching entries" }}
          columns={[
            { key: "t", header: "Time", cell: (e) => formatDateTime(e.createdAt) },
            { key: "u", header: "User", cell: (e) => e.user ? <span>{fullName(e.user)}<span className="block text-sm text-muted">{e.user.email}</span></span> : "System" },
            { key: "a", header: "Action", cell: (e) => <code className="text-sm">{e.action}</code> },
            { key: "r", header: "Resource", cell: (e) => `${e.resource}${e.resourceId ? ` ${e.resourceId.slice(0, 8)}` : ""}` },
            { key: "s", header: "Result", cell: (e) => <StatusBadge status={e.result} /> },
            { key: "ip", header: "IP", cell: (e) => e.ip ?? "-" },
          ]} />
      </Card>
    </>
  );
}
