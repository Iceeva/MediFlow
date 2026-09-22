"use client";
import { useEffect, useState } from "react";
import { CreditCard, Download, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { InvoiceForm, toInvoicePayload, type InvoiceValues } from "@/components/invoices/invoice-form";
import { useApiMutation, useList, useOne } from "@/hooks/use-api";
import { usePermissions } from "@/hooks/use-permissions";
import { api, idempotencyKey } from "@/lib/client";
import { formatDate, formatMoney, fullName } from "@/lib/utils";

interface Invoice { id: string; number: string; status: string; total: string; amountPaid: string; currency: string; dueDate: string | null; createdAt: string; patient: { id: string; firstName: string; lastName: string };
  items: { id: string; description: string; quantity: number; unitPrice: string; total: string }[]; payments: { id: string; amount: string; method: string; status: string; paidAt: string | null; createdAt: string }[] }

const balance = (i: Invoice) => Number(i.total) - Number(i.amountPaid);
const payable = (i: Invoice) => ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(i.status) && balance(i) > 0;

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const { can, role } = usePermissions();
  const { item: inv, isLoading } = useOne<Invoice>(`/invoices/${id}`);
  const [cancel, setCancel] = useState(false);
  const [key] = useState(idempotencyKey); // one key per opened dialog: double clicks cannot create two payments
  const { register, handleSubmit, reset } = useForm<{ amount: string; method: string; reference: string }>({ defaultValues: { method: "CASH" } });
  const record = useApiMutation({
    run: (v: { amount: string; method: string; reference: string }) => api("/payments", { json: { mode: "manual", invoiceId: id, amount: Number(v.amount), method: v.method, reference: v.reference || undefined, idempotencyKey: `${key}-${v.amount}-${v.method}` } }),
    invalidate: ["/invoices", "/payments", "/analytics"], success: "Payment recorded", onDone: () => reset(),
  });
  const online = useApiMutation({
    run: () => api<{ redirectUrl?: string }>("/payments", { json: { mode: "online", invoiceId: id, provider: "stripe", idempotencyKey: key } }),
    invalidate: ["/invoices", "/payments"], onDone: (r) => { const u = (r as { redirectUrl?: string }).redirectUrl; if (u) window.location.assign(u); else toast.message("Payment started"); },
  });
  const setStatus = useApiMutation({ run: (status: "PENDING" | "CANCELLED") => api(`/invoices/${id}`, { method: "PATCH", json: { status } }), invalidate: ["/invoices"], success: "Invoice updated", onDone: () => setCancel(false) });
  if (isLoading || !inv) return <p>Loading invoice</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p><b>{fullName(inv.patient)}</b> - due {formatDate(inv.dueDate)}</p><StatusBadge status={inv.status} /></div>
      <table className="w-full text-left"><thead><tr className="border-b border-line text-sm text-muted"><th className="py-1">Item</th><th>Qty</th><th className="text-right">Total</th></tr></thead>
        <tbody>{inv.items.map((i) => <tr key={i.id} className="border-b border-line/60"><td className="py-1.5">{i.description}</td><td>{i.quantity}</td><td className="text-right">{formatMoney(i.total, inv.currency)}</td></tr>)}</tbody></table>
      <p className="text-right">Total <b>{formatMoney(inv.total, inv.currency)}</b> - paid {formatMoney(inv.amountPaid, inv.currency)} - balance <b>{formatMoney(balance(inv), inv.currency)}</b></p>
      {inv.payments.length > 0 && <ul className="space-y-1 text-sm">{inv.payments.map((p) => <li key={p.id} className="flex justify-between"><span>{formatDate(p.paidAt ?? p.createdAt)} - {p.method.replace(/_/g, " ").toLowerCase()}</span><span><StatusBadge status={p.status} /> {formatMoney(p.amount, inv.currency)}</span></li>)}</ul>}
      <div className="flex flex-wrap justify-end gap-2">
        <a href={`/api/v1/invoices/${id}/pdf`} className="inline-flex h-10 items-center gap-2 rounded-control border border-line px-4 font-bold hover:bg-primary-soft"><Download className="h-4 w-4" />PDF</a>
        {inv.status === "DRAFT" && can("invoice:write") && <Button onClick={() => setStatus.mutate("PENDING")} loading={setStatus.isPending}>Issue invoice</Button>}
        {["DRAFT", "PENDING", "OVERDUE"].includes(inv.status) && Number(inv.amountPaid) === 0 && can("invoice:write") && <Button variant="danger" onClick={() => setCancel(true)}>Cancel invoice</Button>}
        {payable(inv) && can("payment:initiate") && <Button onClick={() => online.mutate(undefined)} loading={online.isPending}><CreditCard className="h-4 w-4" />Pay online</Button>}
      </div>
      {payable(inv) && can("payment:write") && role !== "PATIENT" && (
        <form onSubmit={handleSubmit((v) => record.mutate(v))} className="grid items-end gap-2 rounded-card border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label="Amount received">{(p) => <Input type="number" min={0.01} max={balance(inv)} step="any" required {...p} {...register("amount", { required: true })} />}</Field>
          <Field label="Method">{(p) => <Select {...p} {...register("method")}><option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option><option value="MOBILE_MONEY">Mobile money</option><option value="INSURANCE">Insurance</option></Select>}</Field>
          <Field label="Reference">{(p) => <Input {...p} {...register("reference")} />}</Field>
          <Button type="submit" loading={record.isPending}>Record</Button>
        </form>
      )}
      <ConfirmDialog open={cancel} onClose={() => setCancel(false)} title="Cancel this invoice?" message="A cancelled invoice cannot be paid or reopened." confirmLabel="Cancel invoice" loading={setStatus.isPending} onConfirm={() => setStatus.mutate("CANCELLED")} />
    </div>
  );
}

export default function InvoicesPage() {
  const { can } = usePermissions();
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => { setQ(text); setPage(1); }, 300); return () => clearTimeout(t); }, [text]);
  const list = useList<Invoice>("/invoices", { page, q, status, pageSize: 15 });
  const create = useApiMutation({ run: (v: InvoiceValues) => api("/invoices", { json: toInvoicePayload(v) }), invalidate: ["/invoices", "/analytics"], success: "Invoice created", onDone: () => setCreating(false) });
  return (
    <>
      <PageHeader title="Invoices" description="Totals are always calculated by the server." actions={can("invoice:write") ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New invoice</Button> : undefined} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <Input aria-label="Search invoices" placeholder="Number or patient" className="max-w-xs" value={text} onChange={(e) => setText(e.target.value)} />
          <Select aria-label="Status" className="max-w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Any status</option>{["DRAFT", "PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}</Select>
        </div>
        <DataTable<Invoice> rows={list.rows} loading={list.isLoading} error={list.error} meta={list.meta} onPage={setPage} onRetry={() => list.refetch()} onRowClick={(i) => setOpenId(i.id)}
          empty={{ title: "No invoices found" }}
          columns={[
            { key: "n", header: "Number", cell: (i) => <span className="font-bold">{i.number}</span> },
            { key: "p", header: "Patient", cell: (i) => fullName(i.patient) },
            { key: "t", header: "Total", cell: (i) => formatMoney(i.total, i.currency) },
            { key: "b", header: "Balance", cell: (i) => formatMoney(balance(i), i.currency) },
            { key: "d", header: "Due", cell: (i) => formatDate(i.dueDate) },
            { key: "s", header: "Status", cell: (i) => <StatusBadge status={i.status} /> },
          ]} />
      </Card>
      <Modal wide open={creating} onClose={() => setCreating(false)} title="New invoice"><InvoiceForm submitting={create.isPending} onSubmit={(v) => create.mutate(v)} /></Modal>
      <Modal wide open={!!openId} onClose={() => setOpenId(null)} title="Invoice">{openId && <Detail id={openId} onClose={() => setOpenId(null)} />}</Modal>
    </>
  );
}
