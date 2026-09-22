"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { AvailabilityEditor, StaffForm, type Slot, type StaffValues } from "@/components/doctors/doctor-forms";
import { useApiMutation, useList } from "@/hooks/use-api";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/lib/client";
import { formatMoney, fullName } from "@/lib/utils";

interface Doctor { id: string; specialization: string; licenseNumber?: string; consultationFee: string; status: string; user: { firstName: string; lastName: string; email: string }; availability: (Slot & { id: string })[] }
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DoctorsPage() {
  const { can, me } = usePermissions();
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [inviting, setInviting] = useState(false);
  const [agenda, setAgenda] = useState<Doctor | null>(null);
  useEffect(() => { const t = setTimeout(() => { setQ(text); setPage(1); }, 300); return () => clearTimeout(t); }, [text]);
  const list = useList<Doctor>("/doctors", { page, q, pageSize: 15 });
  const invite = useApiMutation({
    run: (v: StaffValues) => api("/users", { json: { ...v, consultationFee: v.consultationFee ? Number(v.consultationFee) : undefined } }),
    invalidate: ["/doctors", "/users"], success: "Invitation sent", onDone: () => setInviting(false),
  });
  const save = useApiMutation({
    run: (slots: Slot[]) => api(`/doctors/${agenda!.id}/availability`, { method: "PUT", json: { slots } }),
    invalidate: ["/doctors"], success: "Agenda saved", onDone: () => setAgenda(null),
  });
  const canEdit = (d: Doctor) => can("doctor:manage") || me?.doctorId === d.id;
  return (
    <>
      <PageHeader title="Doctors" description="Specializations, fees and weekly availability." actions={can("doctor:manage") ? <Button onClick={() => setInviting(true)}><Plus className="h-4 w-4" />Add doctor</Button> : undefined} />
      <Card>
        <div className="border-b border-line p-4"><Input aria-label="Search doctors" placeholder="Name or specialization" className="max-w-xs" value={text} onChange={(e) => setText(e.target.value)} /></div>
        <DataTable<Doctor> rows={list.rows} loading={list.isLoading} error={list.error} meta={list.meta} onPage={setPage} onRetry={() => list.refetch()}
          empty={{ title: "No doctors found", description: can("doctor:manage") ? "Add your first doctor with the button above." : undefined }}
          columns={[
            { key: "name", header: "Doctor", cell: (d) => <span><span className="font-bold">Dr {fullName(d.user)}</span><span className="block text-sm text-muted">{d.user.email}</span></span> },
            { key: "spec", header: "Specialization", cell: (d) => d.specialization },
            { key: "fee", header: "Fee", cell: (d) => formatMoney(d.consultationFee) },
            { key: "hours", header: "Availability", cell: (d) => d.availability.length ? d.availability.map((a) => `${DAY[a.dayOfWeek]} ${a.startTime}-${a.endTime}`).join(", ") : "Not set" },
            { key: "status", header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
            { key: "act", header: "", cell: (d) => canEdit(d) ? <Button size="sm" variant="secondary" onClick={() => setAgenda(d)}>Edit agenda</Button> : null },
          ]} />
      </Card>
      <Modal open={inviting} onClose={() => setInviting(false)} title="Add a doctor"><StaffForm doctorOnly submitting={invite.isPending} onSubmit={(v) => invite.mutate(v)} /></Modal>
      <Modal open={!!agenda} onClose={() => setAgenda(null)} title={agenda ? `Agenda for Dr ${agenda.user.lastName}` : ""} wide>
        {agenda && <AvailabilityEditor initial={agenda.availability} saving={save.isPending} onSave={(s) => save.mutate(s)} />}
      </Modal>
    </>
  );
}
