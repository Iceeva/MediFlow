"use client";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/form";
import { useList } from "@/hooks/use-api";
import { fullName } from "@/lib/utils";

export interface RxValues {
  patientId: string; notes?: string;
  items: { medicationId?: string; medicationName: string; dosage: string; frequency: string; duration: string; route?: string; instructions?: string }[];
}

export function PrescriptionForm({ patientId, onSubmit, submitting }: { patientId?: string; onSubmit: (v: RxValues) => void; submitting?: boolean }) {
  const patients = useList<{ id: string; firstName: string; lastName: string }>("/patients", { pageSize: 100, sortBy: "lastName", order: "asc" }, !patientId);
  const meds = useList<{ id: string; name: string; strength: string | null; dosageForm: string | null }>("/medications", { pageSize: 100, status: "ACTIVE" });
  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<RxValues>({ defaultValues: { patientId: patientId ?? "", items: [{ medicationName: "", dosage: "", frequency: "", duration: "" }] } });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const pick = (i: number, id: string) => {
    const m = meds.rows?.find((x) => x.id === id);
    setValue(`items.${i}.medicationId`, id || undefined);
    if (m) setValue(`items.${i}.medicationName`, [m.name, m.strength].filter(Boolean).join(" "));
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {!patientId && <Field label="Patient" error={errors.patientId?.message}>{(p) => <Select {...p} {...register("patientId", { required: "Choose a patient" })}><option value="">Select a patient</option>{patients.rows?.map((x) => <option key={x.id} value={x.id}>{fullName(x)}</option>)}</Select>}</Field>}
      {fields.map((f, i) => (
        <fieldset key={f.id} className="space-y-3 rounded-card border border-line p-4">
          <legend className="px-1 font-bold">Medication {i + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From catalog">{(p) => <Select {...p} onChange={(e) => pick(i, e.target.value)}><option value="">Free text</option>{meds.rows?.map((m) => <option key={m.id} value={m.id}>{m.name} {m.strength} {m.dosageForm}</option>)}</Select>}</Field>
            <Field label="Name" error={errors.items?.[i]?.medicationName?.message}>{(p) => <Input {...p} {...register(`items.${i}.medicationName`, { required: "Required", minLength: { value: 2, message: "Too short" } })} />}</Field>
            <Field label="Dosage" error={errors.items?.[i]?.dosage?.message}>{(p) => <Input placeholder="1 tablet" {...p} {...register(`items.${i}.dosage`, { required: "Required" })} />}</Field>
            <Field label="Frequency" error={errors.items?.[i]?.frequency?.message}>{(p) => <Input placeholder="3 times a day" {...p} {...register(`items.${i}.frequency`, { required: "Required" })} />}</Field>
            <Field label="Duration" error={errors.items?.[i]?.duration?.message}>{(p) => <Input placeholder="5 days" {...p} {...register(`items.${i}.duration`, { required: "Required" })} />}</Field>
            <Field label="Route">{(p) => <Input placeholder="Oral" {...p} {...register(`items.${i}.route`)} />}</Field>
          </div>
          <Field label="Instructions">{(p) => <Input {...p} {...register(`items.${i}.instructions`)} />}</Field>
          {fields.length > 1 && <Button variant="ghost" size="sm" onClick={() => remove(i)}><Trash2 className="h-4 w-4" />Remove medication</Button>}
        </fieldset>
      ))}
      <Button variant="secondary" onClick={() => append({ medicationName: "", dosage: "", frequency: "", duration: "" })}><Plus className="h-4 w-4" />Add medication</Button>
      <Field label="Notes for the patient">{(p) => <Textarea className="min-h-16" {...p} {...register("notes")} />}</Field>
      <div className="flex justify-end"><Button type="submit" loading={submitting}>Issue prescription</Button></div>
    </form>
  );
}
