"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useList } from "@/hooks/use-api";
import { formatDateTime, formatMoney, fullName } from "@/lib/utils";

interface Payment { id: string; amount: string; method: string; provider: string; status: string; paidAt: string | null; createdAt: string; invoice: { number: string; currency: string; patient: { firstName: string; lastName: string } } }

function Content() {
  const returned = useSearchParams().get("paid");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const list = useList<Payment>("/payments", { page, status, pageSize: 15 });
  return (
    <>
      <PageHeader title="Payments" description="A payment counts only once the server has confirmed it." />
      {returned && <p role="status" className="mb-4 rounded-control border border-primary/30 bg-primary-soft p-3 font-bold">Thanks. Your payment is being confirmed by the payment provider, its status will update here in a moment.</p>}
      <Card>
        <div className="border-b border-line p-4"><Select aria-label="Status" className="max-w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Any status</option>{["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</Select></div>
        <DataTable<Payment> rows={list.rows} loading={list.isLoading} error={list.error} meta={list.meta} onPage={setPage} onRetry={() => list.refetch()} empty={{ title: "No payments yet" }}
          columns={[
            { key: "d", header: "Date", cell: (p) => formatDateTime(p.paidAt ?? p.createdAt) },
            { key: "i", header: "Invoice", cell: (p) => <span className="font-bold">{p.invoice.number}</span> },
            { key: "p", header: "Patient", cell: (p) => fullName(p.invoice.patient) },
            { key: "m", header: "Method", cell: (p) => `${p.method.replace(/_/g, " ").toLowerCase()} (${p.provider})` },
            { key: "a", header: "Amount", cell: (p) => formatMoney(p.amount, p.invoice.currency) },
            { key: "s", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
          ]} />
      </Card>
    </>
  );
}

export default function PaymentsPage() {
  return <Suspense><Content /></Suspense>;
}
