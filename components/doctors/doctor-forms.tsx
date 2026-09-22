"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../ui/button";
import { Field, Input, Select } from "../ui/form";

const staffSchema = z.object({
  firstName: z.string().min(1, "Required"), lastName: z.string().min(1, "Required"), email: z.string().email("Enter a valid email"),
  role: z.enum(["DOCTOR", "NURSE", "RECEPTIONIST", "ACCOUNTANT", "CLINIC_ADMIN"]),
  specialization: z.string().optional(), licenseNumber: z.string().optional(), consultationFee: z.string().optional(), jobTitle: z.string().optional(),
});
export type StaffValues = z.infer<typeof staffSchema>;

/** Creates a staff account. The person gets an email to choose their own password. */
export function StaffForm({ onSubmit, submitting, doctorOnly }: { onSubmit: (v: StaffValues) => void; submitting?: boolean; doctorOnly?: boolean }) {
  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<StaffValues>({ resolver: zodResolver(staffSchema), defaultValues: { role: "DOCTOR" } });
  const role = doctorOnly ? "DOCTOR" : watch("role");
  const submit = (v: StaffValues) => {
    if (role === "DOCTOR" && !v.specialization) return setError("specialization", { message: "Required for doctors" });
    if (role === "DOCTOR" && !v.licenseNumber) return setError("licenseNumber", { message: "Required for doctors" });
    onSubmit({ ...v, role });
  };
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName?.message}>{(p) => <Input {...p} {...register("firstName")} />}</Field>
        <Field label="Last name" error={errors.lastName?.message}>{(p) => <Input {...p} {...register("lastName")} />}</Field>
      </div>
      <Field label="Email" error={errors.email?.message} hint="They will receive a link to choose their password">{(p) => <Input type="email" {...p} {...register("email")} />}</Field>
      {!doctorOnly && <Field label="Role">{(p) => <Select {...p} {...register("role")}><option value="DOCTOR">Doctor</option><option value="NURSE">Nurse</option><option value="RECEPTIONIST">Receptionist</option><option value="ACCOUNTANT">Accountant</option><option value="CLINIC_ADMIN">Clinic administrator</option></Select>}</Field>}
      {role === "DOCTOR" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Specialization" error={errors.specialization?.message}>{(p) => <Input {...p} {...register("specialization")} />}</Field>
          <Field label="License number" error={errors.licenseNumber?.message}>{(p) => <Input {...p} {...register("licenseNumber")} />}</Field>
          <Field label="Consultation fee">{(p) => <Input type="number" min="0" step="any" {...p} {...register("consultationFee")} />}</Field>
        </div>
      ) : <Field label="Job title">{(p) => <Input {...p} {...register("jobTitle")} />}</Field>}
      <div className="flex justify-end"><Button type="submit" loading={submitting}>Send invitation</Button></div>
    </form>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export interface Slot { dayOfWeek: number; startTime: string; endTime: string }

export function AvailabilityEditor({ initial, onSave, saving }: { initial: Slot[]; onSave: (s: Slot[]) => void; saving?: boolean }) {
  const [slots, setSlots] = useState<Slot[]>(initial.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })));
  const invalid = slots.some((s) => s.startTime >= s.endTime);
  const patch = (i: number, p: Partial<Slot>) => setSlots((all) => all.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="space-y-3">
      {slots.length === 0 && <p className="text-muted">No hours set: appointments are accepted at any time.</p>}
      {slots.map((s, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <Field label="Day">{(p) => <Select {...p} value={s.dayOfWeek} onChange={(e) => patch(i, { dayOfWeek: Number(e.target.value) })}>{DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}</Select>}</Field>
          <Field label="From">{(p) => <Input type="time" {...p} value={s.startTime} onChange={(e) => patch(i, { startTime: e.target.value })} />}</Field>
          <Field label="To">{(p) => <Input type="time" {...p} value={s.endTime} onChange={(e) => patch(i, { endTime: e.target.value })} />}</Field>
          <Button variant="ghost" onClick={() => setSlots((all) => all.filter((_, j) => j !== i))} aria-label={`Remove ${DAYS[s.dayOfWeek]} slot`}>Remove</Button>
        </div>
      ))}
      {invalid && <p role="alert" className="font-bold text-danger">Each slot must end after it starts.</p>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setSlots((a) => [...a, { dayOfWeek: 1, startTime: "08:00", endTime: "17:00" }])}>Add hours</Button>
        <Button onClick={() => onSave(slots)} disabled={invalid} loading={saving}>Save agenda</Button>
      </div>
    </div>
  );
}
