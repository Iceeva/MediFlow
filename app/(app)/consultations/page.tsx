"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { ConsultationForm, toConsultationPayload } from "@/components/consultations/consultation-form";
import { useApiMutation, useList } from "@/hooks/use-api";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/lib/client";
import { formatDate, formatDateTime, fullName } from "@/lib/utils";

interface Vital { id: string; systolic: number | null; diastolic: number | null; heartRate: number | null; temperatureC: string | null; weightKg: string | null; heightCm: string | null; oxygenSaturation: number | null; recordedAt: string }
interface Consultation { id: string; symptoms: string | null; diagnosis: string | null; observations: string | null; treatment: string | null; notes: string | null; followUpAt: string | null; createdAt: string; patient: { id: string; firstName: string; lastName: string }; doctor: { user: { firstName: string; lastName: string } }; vitals: Vital[] }

function Content() {
  const router = useRouter();
  const params = useSearchParams();
  const appointmentId = params.get("appointmentId");
  const { can } = usePermissions();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Consultation | null>(null);
  const list = useList<Consultation>("/consultations", { page, pageSize: 15 });
  const create = useApiMutation({
    run: (v: ReturnType<typeof toConsultationPayload>) => api("/consultations", { json: v }),
    invalidate: ["/consultations", "/appointments", "/analytics"], success: "Consultation saved", onDone: () => router.replace("/consultations"),
  });
  return (
    <>
      <PageHeader title="Consultations" description="Chronological medical history, newest first." />
      <Card>
        <DataTable<Consultation> rows={list.rows} loading={list.isLoading} error={list.error} meta={list.meta} onPage={setPage} onRetry={() => list.refetch()} onRowClick={setOpen}
          empty={{ title: "No consultations yet", description: "Open an appointment and choose Start consultation." }}
          columns={[
            { key: "date", header: "Date", cell: (c) => formatDate(c.createdAt) },
            { key: "patient", header: "Patient", cell: (c) => <span className="font-bold">{fullName(c.patient)}</span> },
            { key: "doctor", header: "Doctor", cell: (c) => `Dr ${c.doctor.user.lastName}` },
            { key: "dx", header: "Diagnosis", cell: (c) => c.diagnosis ?? "-" },
          ]} />
      </Card>
      <Modal wide open={!!open} onClose={() => setOpen(null)} title="Consultation">
        {open && (
          <div className="space-y-4">
            <p className="text-muted">{fullName(open.patient)} - {formatDateTime(open.createdAt)} - Dr {open.doctor.user.lastName}</p>
            {open.vitals.map((v) => (
              <p key={v.id} className="rounded-control bg-primary-soft p-3">
                {[v.systolic && v.diastolic && `BP ${v.systolic}/${v.diastolic}`, v.heartRate && `HR ${v.heartRate}`, v.temperatureC && `${v.temperatureC} C`, v.weightKg && `${v.weightKg} kg`, v.heightCm && `${v.heightCm} cm`, v.oxygenSaturation && `SpO2 ${v.oxygenSaturation}%`].filter(Boolean).join("  |  ")}
              </p>
            ))}
            {([["Symptoms", open.symptoms], ["Diagnosis", open.diagnosis], ["Observations", open.observations], ["Treatment", open.treatment], ["Notes", open.notes]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k}><p className="text-sm text-muted">{k}</p><p className="whitespace-pre-wrap">{v}</p></div>)}
            {open.followUpAt && <p><span className="text-muted">Follow-up: </span><b>{formatDate(open.followUpAt)}</b></p>}
            {can("prescription:write") && <Button onClick={() => router.push(`/prescriptions?patientId=${open.patient.id}&consultationId=${open.id}`)}>Write a prescription</Button>}
          </div>
        )}
      </Modal>
      <Modal wide open={!!appointmentId && can("consultation:write")} onClose={() => router.replace("/consultations")} title="New consultation">
        {appointmentId && <ConsultationForm submitting={create.isPending} onSubmit={(v) => create.mutate(toConsultationPayload(appointmentId, v))} />}
      </Modal>
    </>
  );
}

export default function ConsultationsPage() {
  return <Suspense><Content /></Suspense>;
}
