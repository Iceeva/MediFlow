"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { PatientForm, toPayload } from "@/components/patients/patient-form";
import { Badge } from "@/components/ui/badge";
import { useApiMutation, useList } from "@/hooks/use-api";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/lib/client";
import { age, formatDate, fullName } from "@/lib/utils";

interface Patient { id: string; firstName: string; lastName: string; dateOfBirth: string; gender: string; phone: string | null; email: string | null; archivedAt: string | null }

export default function PatientsPage() {
  const router = useRouter();
  const { can, role } = usePermissions();
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [archived, setArchived] = useState("false");
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setQ(text); setPage(1); }, 300); return () => clearTimeout(t); }, [text]);
  const list = useList<Patient>("/patients", { page, q, archived, pageSize: 15, sortBy: "lastName", order: "asc" });
  const create = useApiMutation({
    run: (v: ReturnType<typeof toPayload>) => api<{ id: string }>("/patients", { json: v }),
    invalidate: ["/patients"], success: "Patient created", onDone: () => setOpen(false),
  });
  return (
    <>
      <PageHeader title={role === "PATIENT" ? "My record" : "Patients"} description="Search, open and manage patient records."
        actions={can("patient:write") ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New patient</Button> : undefined} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <Input aria-label="Search patients" placeholder="Name, email or phone" className="max-w-xs" value={text} onChange={(e) => setText(e.target.value)} />
          {can("patient:archive") && <Select aria-label="Show" className="max-w-40" value={archived} onChange={(e) => { setArchived(e.target.value); setPage(1); }}><option value="false">Active</option><option value="true">Archived</option></Select>}
        </div>
        <DataTable<Patient> rows={list.rows} loading={list.isLoading} error={list.error} meta={list.meta} onPage={setPage} onRetry={() => list.refetch()}
          onRowClick={(p) => router.push(`/patients/${p.id}`)}
          empty={{ title: q ? "No patient matches your search" : "No patients yet", description: q ? "Try a different spelling." : "Create the first patient record to get started." }}
          columns={[
            { key: "name", header: "Patient", cell: (p) => <span className="font-bold">{fullName(p)}{p.archivedAt && <Badge className="ml-2">archived</Badge>}</span> },
            { key: "age", header: "Age", cell: (p) => `${age(p.dateOfBirth)} (${formatDate(p.dateOfBirth)})` },
            { key: "gender", header: "Gender", cell: (p) => p.gender.toLowerCase() },
            { key: "contact", header: "Contact", cell: (p) => p.phone ?? p.email ?? "-" },
          ]} />
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="New patient" wide>
        <PatientForm clinical={can("patient:clinical")} submitting={create.isPending} onSubmit={(v) => create.mutate(toPayload(v, can("patient:clinical")))} />
      </Modal>
    </>
  );
}
