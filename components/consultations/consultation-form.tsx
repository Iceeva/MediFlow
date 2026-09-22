"use client";
import { useForm } from "react-hook-form";
import { Button } from "../ui/button";
import { Field, Input, Textarea } from "../ui/form";

export interface ConsultationValues {
  symptoms?: string; diagnosis?: string; observations?: string; treatment?: string; notes?: string; followUpAt?: string;
  systolic?: string; diastolic?: string; heartRate?: string; temperatureC?: string; weightKg?: string; heightCm?: string; oxygenSaturation?: string;
}

const num = (s?: string) => (s && s.trim() !== "" ? Number(s) : undefined);

export function toConsultationPayload(appointmentId: string, v: ConsultationValues) {
  const vitals = { systolic: num(v.systolic), diastolic: num(v.diastolic), heartRate: num(v.heartRate), temperatureC: num(v.temperatureC), weightKg: num(v.weightKg), heightCm: num(v.heightCm), oxygenSaturation: num(v.oxygenSaturation) };
  return {
    appointmentId, symptoms: v.symptoms || undefined, diagnosis: v.diagnosis || undefined, observations: v.observations || undefined,
    treatment: v.treatment || undefined, notes: v.notes || undefined, followUpAt: v.followUpAt || undefined,
    vitals: Object.values(vitals).some((x) => x !== undefined) ? vitals : undefined,
  };
}

export function ConsultationForm({ onSubmit, submitting }: { onSubmit: (v: ConsultationValues) => void; submitting?: boolean }) {
  const { register, handleSubmit } = useForm<ConsultationValues>();
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <fieldset className="space-y-3 rounded-card border border-line p-4">
        <legend className="px-1 font-bold">Vitals</legend>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Systolic (mmHg)">{(p) => <Input type="number" min={40} max={300} {...p} {...register("systolic")} />}</Field>
          <Field label="Diastolic (mmHg)">{(p) => <Input type="number" min={20} max={200} {...p} {...register("diastolic")} />}</Field>
          <Field label="Heart rate (bpm)">{(p) => <Input type="number" min={20} max={260} {...p} {...register("heartRate")} />}</Field>
          <Field label="Temperature (C)">{(p) => <Input type="number" step="0.1" min={30} max={45} {...p} {...register("temperatureC")} />}</Field>
          <Field label="Weight (kg)">{(p) => <Input type="number" step="0.1" {...p} {...register("weightKg")} />}</Field>
          <Field label="Height (cm)">{(p) => <Input type="number" step="0.1" {...p} {...register("heightCm")} />}</Field>
          <Field label="Oxygen (%)">{(p) => <Input type="number" min={50} max={100} {...p} {...register("oxygenSaturation")} />}</Field>
        </div>
      </fieldset>
      <Field label="Symptoms">{(p) => <Textarea {...p} {...register("symptoms")} />}</Field>
      <Field label="Diagnosis">{(p) => <Textarea className="min-h-16" {...p} {...register("diagnosis")} />}</Field>
      <Field label="Observations">{(p) => <Textarea className="min-h-16" {...p} {...register("observations")} />}</Field>
      <Field label="Treatment">{(p) => <Textarea className="min-h-16" {...p} {...register("treatment")} />}</Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Notes">{(p) => <Input {...p} {...register("notes")} />}</Field>
        <Field label="Follow-up date">{(p) => <Input type="date" {...p} {...register("followUpAt")} />}</Field>
      </div>
      <div className="flex justify-end"><Button type="submit" loading={submitting}>Save consultation</Button></div>
    </form>
  );
}
