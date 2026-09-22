"use client";
import { useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { useApiMutation, useList } from "@/hooks/use-api";
import { usePermissions } from "@/hooks/use-permissions";
import { api, ApiClientError } from "@/lib/client";
import { formatDateTime, fullName } from "@/lib/utils";

interface Doc { id: string; fileName: string; type: string; mimeType: string; size: number; accessPolicy: string; uploadedById: string; createdAt: string; patient: { id: string; firstName: string; lastName: string } }
interface Values { patientId: string; type: string; accessPolicy: string; file: FileList }

const MAX = 4 * 1024 * 1024;
const kb = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export default function DocumentsPage() {
  const { can, me } = usePermissions();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Doc | null>(null);
  const list = useList<Doc>("/documents", { page, pageSize: 15 });
  const patients = useList<{ id: string; firstName: string; lastName: string }>("/patients", { pageSize: 100, sortBy: "lastName", order: "asc" }, can("document:write"));
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({ defaultValues: { type: "OTHER", accessPolicy: "STAFF_ONLY" } });

  const upload = useApiMutation({
    run: (v: Values) => {
      const f = new FormData();
      f.set("patientId", v.patientId); f.set("type", v.type); f.set("accessPolicy", v.accessPolicy); f.set("file", v.file[0]!);
      return api("/documents", { form: f });
    },
    invalidate: ["/documents"], success: "Document uploaded", onDone: () => { setOpen(false); reset(); },
  });
  const remove = useApiMutation({ run: (id: string) => api(`/documents/${id}`, { method: "DELETE" }), invalidate: ["/documents"], success: "Document deleted", onDone: () => setDel(null) });

  // Two steps: ask for a short-lived signed link, then follow it. Access is re-checked on both calls.
  async function download(d: Doc) {
    try {
      const { data } = await api<{ url: string }>(`/documents/${d.id}/url`, { method: "POST" });
      window.location.assign(data.url);
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Download failed"); }
  }

  return (
    <>
      <PageHeader title="Medical documents" description="Private files. Every download is signed, short-lived and recorded in the audit log."
        actions={can("document:write") ? <Button onClick={() => setOpen(true)}><Upload className="h-4 w-4" />Upload document</Button> : undefined} />
      <Card>
        <DataTable<Doc> rows={list.rows} loading={list.isLoading} error={list.error} meta={list.meta} onPage={setPage} onRetry={() => list.refetch()}
          empty={{ title: "No documents yet", description: can("document:write") ? "Upload a PDF or image to a patient record." : "Documents shared with you will appear here." }}
          columns={[
            { key: "f", header: "File", cell: (d) => <span className="font-bold">{d.fileName}</span> },
            { key: "t", header: "Type", cell: (d) => d.type.replace(/_/g, " ").toLowerCase() },
            { key: "p", header: "Patient", cell: (d) => fullName(d.patient) },
            { key: "s", header: "Size", cell: (d) => kb(d.size) },
            { key: "v", header: "Visibility", cell: (d) => <Badge tone={d.accessPolicy === "PATIENT_VISIBLE" ? "primary" : "neutral"}>{d.accessPolicy === "PATIENT_VISIBLE" ? "shared with patient" : "staff only"}</Badge> },
            { key: "c", header: "Added", cell: (d) => formatDateTime(d.createdAt) },
            { key: "a", header: "", cell: (d) => (
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => download(d)}><Download className="h-4 w-4" />Download</Button>
                {can("document:delete") && me && d.uploadedById === me.userId && <Button size="icon" variant="ghost" aria-label={`Delete ${d.fileName}`} onClick={() => setDel(d)}><Trash2 className="h-4 w-4" /></Button>}
              </div>) },
          ]} />
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Upload a document">
        <form onSubmit={handleSubmit((v) => upload.mutate(v))} className="space-y-3" noValidate>
          <Field label="Patient" error={errors.patientId?.message}>{(p) => <Select {...p} {...register("patientId", { required: "Choose a patient" })}><option value="">Select a patient</option>{patients.rows?.map((x) => <option key={x.id} value={x.id}>{fullName(x)}</option>)}</Select>}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">{(p) => <Select {...p} {...register("type")}>{["LAB_RESULT", "MEDICAL_REPORT", "SCAN", "IMAGE", "PDF", "PRESCRIPTION", "INVOICE", "OTHER"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>)}</Select>}</Field>
            <Field label="Who can see it">{(p) => <Select {...p} {...register("accessPolicy")}><option value="STAFF_ONLY">Clinic staff only</option><option value="PATIENT_VISIBLE">Staff and the patient</option></Select>}</Field>
          </div>
          <Field label="File" hint="PDF, PNG, JPEG or WebP, up to 4 MB" error={errors.file?.message as string | undefined}>
            {(p) => <Input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="h-auto py-2" {...p} {...register("file", { validate: (f) => (f?.length ? (f[0]!.size <= MAX ? true : "The file is larger than 4 MB") : "Choose a file") })} />}
          </Field>
          <div className="flex justify-end"><Button type="submit" loading={upload.isPending}>Upload</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Delete this document?" message={`"${del?.fileName ?? ""}" will be removed from storage. This action is irreversible.`} confirmLabel="Delete document" loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} />
    </>
  );
}
