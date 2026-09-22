"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useApiMutation, useList } from "@/hooks/use-api";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/lib/client";

interface Med { id: string; name: string; genericName: string | null; dosageForm: string | null; strength: string | null; manufacturer: string | null; status: string }
interface Values { name: string; genericName?: string; dosageForm?: string; strength?: string; manufacturer?: string }

export default function MedicationsPage() {
  const { can } = usePermissions();
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [stop, setStop] = useState<Med | null>(null);
  useEffect(() => { const t = setTimeout(() => { setQ(text); setPage(1); }, 300); return () => clearTimeout(t); }, [text]);
  const list = useList<Med>("/medications", { page, q, status, pageSize: 20, sortBy: "name", order: "asc" });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>();
  const clean = (v: Values) => Object.fromEntries(Object.entries(v).filter(([, x]) => x));
  const create = useApiMutation({ run: (v: Values) => api("/medications", { json: clean(v) }), invalidate: ["/medications"], success: "Medication added", onDone: () => { setOpen(false); reset(); } });
  const discontinue = useApiMutation({ run: (id: string) => api(`/medications/${id}`, { method: "DELETE" }), invalidate: ["/medications"], success: "Medication discontinued", onDone: () => setStop(null) });
  return (
    <>
      <PageHeader title="Medication catalog" description="The clinic's formulary, available when writing prescriptions."
        actions={can("medication:manage") ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add medication</Button> : undefined} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <Input aria-label="Search medications" placeholder="Brand or generic name" className="max-w-xs" value={text} onChange={(e) => setText(e.target.value)} />
          <Select aria-label="Status" className="max-w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Any status</option><option value="ACTIVE">Active</option><option value="DISCONTINUED">Discontinued</option></Select>
        </div>
        <DataTable<Med> rows={list.rows} loading={list.isLoading} error={list.error} meta={list.meta} onPage={setPage} onRetry={() => list.refetch()} empty={{ title: "No medications found" }}
          columns={[
            { key: "n", header: "Name", cell: (m) => <span className="font-bold">{m.name}</span> },
            { key: "g", header: "Generic", cell: (m) => m.genericName ?? "-" },
            { key: "f", header: "Form and strength", cell: (m) => [m.dosageForm, m.strength].filter(Boolean).join(" ") || "-" },
            { key: "m", header: "Manufacturer", cell: (m) => m.manufacturer ?? "-" },
            { key: "s", header: "Status", cell: (m) => <StatusBadge status={m.status} /> },
            { key: "a", header: "", cell: (m) => can("medication:manage") && m.status === "ACTIVE" ? <Button size="sm" variant="ghost" onClick={() => setStop(m)}>Discontinue</Button> : null },
          ]} />
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add medication">
        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-3" noValidate>
          <Field label="Name" error={errors.name?.message}>{(p) => <Input {...p} {...register("name", { required: "Required", minLength: { value: 2, message: "Too short" } })} />}</Field>
          <Field label="Generic name">{(p) => <Input {...p} {...register("genericName")} />}</Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Dosage form">{(p) => <Input placeholder="Tablet" {...p} {...register("dosageForm")} />}</Field><Field label="Strength">{(p) => <Input placeholder="500 mg" {...p} {...register("strength")} />}</Field></div>
          <Field label="Manufacturer">{(p) => <Input {...p} {...register("manufacturer")} />}</Field>
          <div className="flex justify-end"><Button type="submit" loading={create.isPending}>Add medication</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!stop} onClose={() => setStop(null)} title={`Discontinue ${stop?.name ?? ""}?`} message="It will no longer be offered for new prescriptions. Past prescriptions are not affected." confirmLabel="Discontinue" loading={discontinue.isPending} onConfirm={() => stop && discontinue.mutate(stop.id)} />
    </>
  );
}
