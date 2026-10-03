"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Download, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { PatientForm, toPayload, type PatientFormValues } from "@/components/patients/patient-form";
import { useApiMutation, useList, useOne } from "@/hooks/use-api";
import { usePermissions } from "@/hooks/use-permissions";
import { api, ApiClientError } from "@/lib/client";
import { age, formatDate, fullName } from "@/lib/utils";

interface Patient extends Partial<Omit<PatientFormValues, "firstName" | "lastName" | "dateOfBirth" | "gender" | "allergies" | "insuranceProvider">> { id: string; firstName: string; lastName: string; dateOfBirth: string; gender: string; allergies?: string[]; archivedAt: string | null; insuranceProvider?: string | null }

const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div><dt className="text-sm text-muted">{label}</dt><dd className="font-bold">{value || "-"}</dd></div>
);

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = usePermissions();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const { item: p, isLoading, error, refetch } = useOne<Patient>(`/patients/${id}`);
  const consults = useList<{ id: string; diagnosis: string | null; createdAt: string; doctor: { user: { firstName: string; lastName: string } } }>("/consultations", { patientId: id, pageSize: 10 }, can("consultation:read"));
  const rx = useList<{ id: string; number: string; issuedAt: string; items: unknown[] }>("/prescriptions", { patientId: id, pageSize: 10 }, can("prescription:read"));
  const clinical = can("patient:clinical");

  const update = useApiMutation({ run: (v: PatientFormValues) => api(`/patients/${id}`, { method: "PATCH", json: toPayload(v, clinical) }), invalidate: ["/patients"], success: "Patient updated", onDone: () => setEdit(false) });
  const archive = useApiMutation({ run: (archived: boolean) => api(`/patients/${id}`, { method: "PATCH", json: { archived } }), invalidate: ["/patients"], success: "Patient updated" });
  const remove = useApiMutation({ run: () => api(`/patients/${id}`, { method: "DELETE" }), invalidate: ["/patients"], success: "Patient deleted", onDone: () => router.replace("/patients") });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (error) return <ErrorState message={error instanceof ApiClientError && error.status === 404 ? "This patient does not exist or you do not have access to it." : error.message} onRetry={() => refetch()} />;
  if (!p) return null;

  return (
    <>
      <PageHeader crumbs={[{ label: "Patients", href: "/patients" }, { label: fullName(p) }]} title={fullName(p)} description={`${age(p.dateOfBirth)} years old - born ${formatDate(p.dateOfBirth)}`}
        actions={<>
          {can("patient:write") && <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Edit</Button>}
          {clinical && <a href={`/api/v1/patients/${id}/export`} className="inline-flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-4 font-bold hover:bg-primary-soft"><Download className="h-4 w-4" />Export</a>}
          {can("patient:archive") && <Button variant="secondary" onClick={() => archive.mutate(!p.archivedAt)} loading={archive.isPending}><Archive className="h-4 w-4" />{p.archivedAt ? "Restore" : "Archive"}</Button>}
          {can("patient:archive") && <Button variant="danger" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" />Delete</Button>}
        </>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Profile" action={p.archivedAt ? <Badge>archived</Badge> : undefined} />
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Row label="Phone" value={p.phone} /><Row label="Email" value={p.email} /><Row label="Address" value={p.address} />
              <Row label="Emergency contact" value={p.emergencyContactName ? `${p.emergencyContactName} ${p.emergencyContactPhone ?? ""}` : undefined} />
              {clinical && <>
                <Row label="Blood type" value={p.bloodType} />
                <Row label="Allergies" value={p.allergies?.length ? p.allergies.map((a) => <Badge key={a} tone="danger" className="mr-1">{a}</Badge>) : "None recorded"} />
                <Row label="Insurance" value={p.insuranceProvider ? `${p.insuranceProvider} ${p.insuranceNumber ?? ""}` : undefined} />
                <div className="sm:col-span-2"><Row label="Medical history" value={p.medicalHistory} /></div>
                <div className="sm:col-span-2"><Row label="Current medications" value={p.currentMedications} /></div>
              </>}
            </dl>
          </CardBody>
        </Card>
        <div className="space-y-4">
          {can("consultation:read") && (
            <Card><CardHeader title="Consultations" />
              {!consults.rows?.length ? <EmptyState title="No consultations" /> : <ul className="divide-y divide-line">{consults.rows.map((c) => <li key={c.id} className="px-5 py-3"><p className="font-bold">{formatDate(c.createdAt)} - Dr {c.doctor.user.lastName}</p><p className="text-sm text-muted">{c.diagnosis ?? "No diagnosis recorded"}</p></li>)}</ul>}
            </Card>)}
          {can("prescription:read") && (
            <Card><CardHeader title="Prescriptions" action={<Link href="/prescriptions" className="text-sm font-bold text-primary underline">All</Link>} />
              {!rx.rows?.length ? <EmptyState title="No prescriptions" /> : <ul className="divide-y divide-line">{rx.rows.map((r) => <li key={r.id} className="flex items-center justify-between px-5 py-3"><span><span className="font-bold">{r.number}</span><span className="block text-sm text-muted">{formatDate(r.issuedAt)}</span></span><a href={`/api/v1/prescriptions/${r.id}/pdf`} className="text-sm font-bold text-primary underline">PDF</a></li>)}</ul>}
            </Card>)}
        </div>
      </div>
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit patient" wide>
        <PatientForm clinical={clinical} submitting={update.isPending} onSubmit={(v) => update.mutate(v)}
          initial={{ ...p, dateOfBirth: p.dateOfBirth.slice(0, 10), allergies: p.allergies?.join(", "), email: p.email ?? "", phone: p.phone ?? "" } as Partial<PatientFormValues>} />
      </Modal>
      <ConfirmDialog open={del} onClose={() => setDel(false)} title="Delete this patient?" message="The record will be hidden from everyone. This action is irreversible from the interface. It stays in the audit trail." confirmLabel="Delete patient" loading={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
    </>
  );
}
