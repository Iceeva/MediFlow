"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/form";
import { useList } from "@/hooks/use-api";
import { fullName } from "@/lib/utils";

const schema = z.object({
  patientId: z.string().optional(), doctorId: z.string().min(1, "Choose a doctor"),
  date: z.string().min(1, "Choose a date"), start: z.string().min(1, "Required"), end: z.string().min(1, "Required"),
  reason: z.string().max(300).optional(),
}).refine((v) => v.end > v.start, { path: ["end"], message: "End must be after start" });
export type AppointmentValues = z.infer<typeof schema>;

export const toIso = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();

export function AppointmentForm({ isPatient, initial, onSubmit, submitting }: { isPatient: boolean; initial?: Partial<AppointmentValues>; onSubmit: (v: AppointmentValues) => void; submitting?: boolean }) {
  const doctors = useList<{ id: string; specialization: string; user: { firstName: string; lastName: string } }>("/doctors", { pageSize: 100 });
  const patients = useList<{ id: string; firstName: string; lastName: string }>("/patients", { pageSize: 100, sortBy: "lastName", order: "asc" }, !isPatient);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<AppointmentValues>({ resolver: zodResolver(schema), defaultValues: initial });
  const submit = (v: AppointmentValues) => (!isPatient && !v.patientId ? setError("patientId", { message: "Choose a patient" }) : onSubmit(v));
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      {!isPatient && <Field label="Patient" error={errors.patientId?.message}>{(p) => <Select {...p} {...register("patientId")}><option value="">Select a patient</option>{patients.rows?.map((x) => <option key={x.id} value={x.id}>{fullName(x)}</option>)}</Select>}</Field>}
      <Field label="Doctor" error={errors.doctorId?.message}>{(p) => <Select {...p} {...register("doctorId")}><option value="">Select a doctor</option>{doctors.rows?.map((d) => <option key={d.id} value={d.id}>Dr {fullName(d.user)} - {d.specialization}</option>)}</Select>}</Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date" error={errors.date?.message}>{(p) => <Input type="date" min={new Date().toISOString().slice(0, 10)} {...p} {...register("date")} />}</Field>
        <Field label="From" error={errors.start?.message}>{(p) => <Input type="time" step={900} {...p} {...register("start")} />}</Field>
        <Field label="To" error={errors.end?.message}>{(p) => <Input type="time" step={900} {...p} {...register("end")} />}</Field>
      </div>
      <Field label="Reason for the visit">{(p) => <Textarea className="min-h-16" {...p} {...register("reason")} />}</Field>
      <div className="flex justify-end"><Button type="submit" loading={submitting}>{isPatient ? "Request appointment" : "Book appointment"}</Button></div>
    </form>
  );
}
