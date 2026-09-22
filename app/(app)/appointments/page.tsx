"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { AppointmentCalendar, type Appt } from "@/components/appointments/calendar";
import { AppointmentForm, toIso, type AppointmentValues } from "@/components/appointments/appointment-form";
import { useApiMutation, useList } from "@/hooks/use-api";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/lib/client";
import { TRANSITIONS, type AppointmentStatusValue } from "@/features/appointments/schemas";
import { formatDateTime, fullName } from "@/lib/utils";

export default function AppointmentsPage() {
  const router = useRouter();
  const { can, role } = usePermissions();
  const isPatient = role === "PATIENT";
  const [doctorId, setDoctorId] = useState("");
  const [creating, setCreating] = useState<Partial<AppointmentValues> | null>(null);
  const [selected, setSelected] = useState<Appt | null>(null);
  const [cancel, setCancel] = useState(false);
  const doctors = useList<{ id: string; user: { firstName: string; lastName: string } }>("/doctors", { pageSize: 100 }, !isPatient && role !== "DOCTOR");

  const create = useApiMutation({
    run: (v: AppointmentValues) => api("/appointments", { json: { patientId: v.patientId || undefined, doctorId: v.doctorId, startsAt: toIso(v.date, v.start), endsAt: toIso(v.date, v.end), reason: v.reason || undefined } }),
    invalidate: ["/appointments", "/analytics"], success: "Appointment booked", onDone: () => setCreating(null),
  });
  const setStatus = useApiMutation({
    run: (status: AppointmentStatusValue) => api(`/appointments/${selected!.id}`, { method: "PATCH", json: { status } }),
    invalidate: ["/appointments", "/analytics"], success: "Appointment updated", onDone: () => { setSelected(null); setCancel(false); },
  });

  const next = selected ? TRANSITIONS[selected.status as AppointmentStatusValue].filter((s) => s !== "CANCELLED") : [];
  const canCancel = selected && TRANSITIONS[selected.status as AppointmentStatusValue].includes("CANCELLED");
  return (
    <>
      <PageHeader title="Appointments" description="Day, week and month agenda. Double bookings are blocked by the server."
        actions={(can("appointment:write") || can("appointment:book")) ? <Button onClick={() => setCreating({})}><Plus className="h-4 w-4" />{isPatient ? "Request appointment" : "New appointment"}</Button> : undefined} />
      <Card>
        {!isPatient && role !== "DOCTOR" && (
          <div className="border-b border-line p-4"><Select aria-label="Filter by doctor" className="max-w-xs" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}><option value="">All doctors</option>{doctors.rows?.map((d) => <option key={d.id} value={d.id}>Dr {fullName(d.user)}</option>)}</Select></div>
        )}
        <CardBody>
          <AppointmentCalendar doctorId={doctorId || undefined} onSelect={setSelected}
            onSlot={can("appointment:write") ? (s, e) => setCreating({ date: s.toISOString().slice(0, 10), start: s.toTimeString().slice(0, 5), end: e.toTimeString().slice(0, 5) }) : undefined} />
        </CardBody>
      </Card>

      <Modal open={!!creating} onClose={() => setCreating(null)} title={isPatient ? "Request an appointment" : "New appointment"}>
        {creating && <AppointmentForm isPatient={isPatient} initial={creating} submitting={create.isPending} onSubmit={(v) => create.mutate(v)} />}
      </Modal>

      <Modal open={!!selected && !cancel} onClose={() => setSelected(null)} title="Appointment">
        {selected && (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div><dt className="text-sm text-muted">Patient</dt><dd className="font-bold">{fullName(selected.patient)}</dd></div>
              <div><dt className="text-sm text-muted">Doctor</dt><dd className="font-bold">Dr {fullName(selected.doctor.user)}</dd></div>
              <div><dt className="text-sm text-muted">When</dt><dd className="font-bold">{formatDateTime(selected.startsAt)}</dd></div>
              <div><dt className="text-sm text-muted">Status</dt><dd><StatusBadge status={selected.status} /></dd></div>
              {selected.reason && <div className="sm:col-span-2"><dt className="text-sm text-muted">Reason</dt><dd>{selected.reason}</dd></div>}
            </dl>
            <div className="flex flex-wrap justify-end gap-2">
              {!isPatient && can("appointment:write") && next.map((s) => <Button key={s} variant="secondary" loading={setStatus.isPending} onClick={() => setStatus.mutate(s)}>Mark {s.replace(/_/g, " ").toLowerCase()}</Button>)}
              {role === "DOCTOR" && selected.status !== "COMPLETED" && selected.status !== "CANCELLED" && !selected.consultation && <Button onClick={() => router.push(`/consultations?appointmentId=${selected.id}`)}>Start consultation</Button>}
              {canCancel && (can("appointment:write") || isPatient) && <Button variant="danger" onClick={() => setCancel(true)}>Cancel appointment</Button>}
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={cancel} onClose={() => setCancel(false)} title="Cancel this appointment?" message="The patient and doctor will be notified. This cannot be undone." confirmLabel="Cancel appointment" loading={setStatus.isPending} onConfirm={() => setStatus.mutate("CANCELLED")} />
    </>
  );
}
