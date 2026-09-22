"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { PrescriptionForm, type RxValues } from "@/components/prescriptions/prescription-form";
import { useApiMutation, useList } from "@/hooks/use-api";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/lib/client";
import { formatDate, fullName } from "@/lib/utils";

interface Rx { id: string; number: string; issuedAt: string; patient: { id: string; firstName: string; lastName: string }; doctor: { user: { firstName: string; lastName: string } }; items: { id: string; medicationName: string; dosage: string; frequency: string; duration: string }[] }

function Content() {
  const router = useRouter();
  const params = useSearchParams();
  const preset = { patientId: params.get("patientId") ?? undefined, consultationId: params.get("consultationId") ?? undefined };
  const { can } = usePermissions();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(!!preset.patientId);
  const list = useList<Rx>("/prescriptions", { page, pageSize: 15 });
  const create = useApiMutation({
    run: (v: RxValues) => api("/prescriptions", { json: { ...v, consultationId: preset.consultationId, items: v.items.map((i) => ({ ...i, medicationId: i.medicationId || undefined, route: i.route || undefined, instructions: i.instructions || undefined })) } }),
    invalidate: ["/prescriptions"], success: "Prescription issued", onDone: () => { setCreating(false); router.replace("/prescriptions"); },
  });
  return (
    <>
      <PageHeader title="Prescriptions" description="Issued prescriptions with downloadable PDFs."
        actions={can("prescription:write") ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New prescription</Button> : undefined} />
      <Card>
        <DataTable<Rx> rows={list.rows} loading={list.isLoading} error={list.error} meta={list.meta} onPage={setPage} onRetry={() => list.refetch()}
          empty={{ title: "No prescriptions yet" }}
          columns={[
            { key: "n", header: "Number", cell: (r) => <span className="font-bold">{r.number}</span> },
            { key: "d", header: "Issued", cell: (r) => formatDate(r.issuedAt) },
            { key: "p", header: "Patient", cell: (r) => fullName(r.patient) },
            { key: "m", header: "Medications", cell: (r) => r.items.map((i) => i.medicationName).join(", ") },
            { key: "doc", header: "Doctor", cell: (r) => `Dr ${r.doctor.user.lastName}` },
            { key: "pdf", header: "", cell: (r) => <a className="inline-flex items-center gap-1 font-bold text-primary underline" href={`/api/v1/prescriptions/${r.id}/pdf`}><Download className="h-4 w-4" />PDF</a> },
          ]} />
      </Card>
      <Modal wide open={creating} onClose={() => { setCreating(false); router.replace("/prescriptions"); }} title="New prescription">
        <PrescriptionForm patientId={preset.patientId} submitting={create.isPending} onSubmit={(v) => create.mutate(v)} />
      </Modal>
    </>
  );
}

export default function PrescriptionsPage() {
  return <Suspense><Content /></Suspense>;
}
