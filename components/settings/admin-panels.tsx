"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/badge";
import { Card, CardBody, CardHeader } from "../ui/card";
import { Field, Input } from "../ui/form";
import { Modal } from "../ui/modal";
import { DataTable } from "../ui/data-table";
import { StaffForm, type StaffValues } from "../doctors/doctor-forms";
import { useApiMutation, useList } from "@/hooks/use-api";
import { api } from "@/lib/client";
import { formatDate, fullName } from "@/lib/utils";

export function ClinicPanel({ tenant }: { tenant: { id: string; name: string } }) {
  const { register, handleSubmit } = useForm<{ name: string; phone: string; address: string; timezone: string }>({ defaultValues: { name: tenant.name } });
  const save = useApiMutation({ run: (v: Record<string, string>) => api(`/tenants/${tenant.id}`, { method: "PATCH", json: Object.fromEntries(Object.entries(v).filter(([, x]) => x)) }), invalidate: ["/auth/me"], success: "Clinic profile saved" });
  return (
    <Card>
      <CardHeader title="Clinic profile" />
      <CardBody>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-3 sm:grid-cols-2">
          <Field label="Clinic name">{(p) => <Input {...p} {...register("name")} />}</Field>
          <Field label="Phone">{(p) => <Input type="tel" {...p} {...register("phone")} />}</Field>
          <Field label="Address">{(p) => <Input {...p} {...register("address")} />}</Field>
          <Field label="Time zone" hint="IANA name such as Africa/Porto-Novo. Used for doctor availability.">{(p) => <Input {...p} {...register("timezone")} />}</Field>
          <div className="sm:col-span-2"><Button type="submit" loading={save.isPending}>Save profile</Button></div>
        </form>
      </CardBody>
    </Card>
  );
}

interface Member { id: string; email: string; firstName: string; lastName: string; role: string; disabled: boolean; memberSince: string }

export function TeamPanel() {
  const [page, setPage] = useState(1);
  const [inviting, setInviting] = useState(false);
  const list = useList<Member>("/users", { page, pageSize: 10 });
  const invite = useApiMutation({
    run: (v: StaffValues) => api("/users", { json: { ...v, consultationFee: v.consultationFee ? Number(v.consultationFee) : undefined } }),
    invalidate: ["/users", "/doctors"], success: "Invitation sent", onDone: () => setInviting(false),
  });
  const toggle = useApiMutation({ run: (m: Member) => api(`/users/${m.id}`, { method: "PATCH", json: { disabled: !m.disabled } }), invalidate: ["/users"], success: "Account updated" });
  return (
    <Card>
      <CardHeader title="Team and patients accounts" action={<Button size="sm" onClick={() => setInviting(true)}><Plus className="h-4 w-4" />Invite staff</Button>} />
      <DataTable<Member> rows={list.rows} loading={list.isLoading} error={list.error} meta={list.meta} onPage={setPage} onRetry={() => list.refetch()} empty={{ title: "No members yet" }}
        columns={[
          { key: "n", header: "Name", cell: (m) => <span><span className="font-bold">{fullName(m)}</span><span className="block text-sm text-muted">{m.email}</span></span> },
          { key: "r", header: "Role", cell: (m) => m.role.replace(/_/g, " ").toLowerCase() },
          { key: "s", header: "Status", cell: (m) => <StatusBadge status={m.disabled ? "INACTIVE" : "ACTIVE"} /> },
          { key: "d", header: "Since", cell: (m) => formatDate(m.memberSince) },
          { key: "a", header: "", cell: (m) => <Button size="sm" variant="ghost" onClick={() => toggle.mutate(m)}>{m.disabled ? "Enable" : "Disable"}</Button> },
        ]} />
      <Modal open={inviting} onClose={() => setInviting(false)} title="Invite a staff member"><StaffForm submitting={invite.isPending} onSubmit={(v) => invite.mutate(v)} /></Modal>
    </Card>
  );
}

interface Clinic { id: string; name: string; slug: string; status: string; createdAt: string }

export function ClinicsPanel() {
  const [open, setOpen] = useState(false);
  const list = useList<Clinic>("/tenants");
  const { register, handleSubmit, reset } = useForm<{ name: string; slug: string; email: string; firstName: string; lastName: string }>();
  const create = useApiMutation({
    run: (v: { name: string; slug: string; email: string; firstName: string; lastName: string }) => api("/tenants", { json: { name: v.name, slug: v.slug, admin: { email: v.email, firstName: v.firstName, lastName: v.lastName } } }),
    invalidate: ["/tenants"], success: "Clinic created, its administrator was invited", onDone: () => { setOpen(false); reset(); },
  });
  const toggle = useApiMutation({ run: (c: Clinic) => api(`/tenants/${c.id}`, { method: "PATCH", json: { status: c.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" } }), invalidate: ["/tenants"], success: "Clinic updated" });
  return (
    <Card>
      <CardHeader title="Clinics" action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New clinic</Button>} />
      <DataTable<Clinic> rows={list.rows} loading={list.isLoading} error={list.error} empty={{ title: "No clinics yet" }}
        columns={[
          { key: "n", header: "Clinic", cell: (c) => <span><span className="font-bold">{c.name}</span><span className="block text-sm text-muted">{c.slug}</span></span> },
          { key: "s", header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
          { key: "d", header: "Created", cell: (c) => formatDate(c.createdAt) },
          { key: "a", header: "", cell: (c) => <Button size="sm" variant="ghost" onClick={() => toggle.mutate(c)}>{c.status === "ACTIVE" ? "Suspend" : "Reactivate"}</Button> },
        ]} />
      <Modal open={open} onClose={() => setOpen(false)} title="New clinic">
        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-3">
          <Field label="Clinic name">{(p) => <Input required {...p} {...register("name", { required: true })} />}</Field>
          <Field label="Clinic address (short name)" hint="3-40 lowercase letters, digits or dashes">{(p) => <Input required pattern="[a-z0-9-]{3,40}" {...p} {...register("slug", { required: true })} />}</Field>
          <p className="font-bold">Administrator</p>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="First name">{(p) => <Input required {...p} {...register("firstName", { required: true })} />}</Field><Field label="Last name">{(p) => <Input required {...p} {...register("lastName", { required: true })} />}</Field></div>
          <Field label="Email">{(p) => <Input type="email" required {...p} {...register("email", { required: true })} />}</Field>
          <div className="flex justify-end"><Button type="submit" loading={create.isPending}>Create clinic</Button></div>
        </form>
      </Modal>
    </Card>
  );
}
