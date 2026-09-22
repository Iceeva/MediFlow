"use client";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Field, Input, Select } from "../ui/form";
import { useList } from "@/hooks/use-api";
import { formatMoney, fullName } from "@/lib/utils";

export interface InvoiceValues {
  patientId: string; dueDate?: string; discount: string; taxRatePercent: string; notes?: string; issue: boolean;
  items: { description: string; quantity: string; unitPrice: string }[];
}

export const toInvoicePayload = (v: InvoiceValues) => ({
  patientId: v.patientId, issue: v.issue, notes: v.notes || undefined, dueDate: v.dueDate || undefined,
  discount: Number(v.discount || 0), taxRatePercent: Number(v.taxRatePercent || 0),
  items: v.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
});

export function InvoiceForm({ onSubmit, submitting }: { onSubmit: (v: InvoiceValues) => void; submitting?: boolean }) {
  const patients = useList<{ id: string; firstName: string; lastName: string }>("/patients", { pageSize: 100, sortBy: "lastName", order: "asc" });
  const { register, control, handleSubmit, formState: { errors } } = useForm<InvoiceValues>({ defaultValues: { discount: "0", taxRatePercent: "0", issue: true, items: [{ description: "", quantity: "1", unitPrice: "" }] } });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const w = useWatch({ control });
  // Preview only. The server recomputes every figure and ignores client totals.
  const sub = (w.items ?? []).reduce((a, i) => a + Number(i?.quantity || 0) * Number(i?.unitPrice || 0), 0);
  const disc = Math.min(Number(w.discount || 0), sub);
  const total = (sub - disc) * (1 + Number(w.taxRatePercent || 0) / 100);
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Patient" error={errors.patientId?.message}>{(p) => <Select {...p} {...register("patientId", { required: "Choose a patient" })}><option value="">Select a patient</option>{patients.rows?.map((x) => <option key={x.id} value={x.id}>{fullName(x)}</option>)}</Select>}</Field>
      {fields.map((f, i) => (
        <div key={f.id} className="grid items-end gap-2 sm:grid-cols-[1fr_80px_130px_auto]">
          <Field label={i === 0 ? "Description" : `Line ${i + 1}`} error={errors.items?.[i]?.description?.message}>{(p) => <Input {...p} {...register(`items.${i}.description`, { required: "Required" })} />}</Field>
          <Field label="Qty" error={errors.items?.[i]?.quantity?.message}>{(p) => <Input type="number" min={1} step={1} {...p} {...register(`items.${i}.quantity`, { required: "Required", min: { value: 1, message: ">= 1" } })} />}</Field>
          <Field label="Unit price" error={errors.items?.[i]?.unitPrice?.message}>{(p) => <Input type="number" min={0} step="any" {...p} {...register(`items.${i}.unitPrice`, { required: "Required", min: { value: 0, message: ">= 0" } })} />}</Field>
          {fields.length > 1 && <Button variant="ghost" size="icon" aria-label={`Remove line ${i + 1}`} onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => append({ description: "", quantity: "1", unitPrice: "" })}><Plus className="h-4 w-4" />Add line</Button>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Discount">{(p) => <Input type="number" min={0} step="any" {...p} {...register("discount")} />}</Field>
        <Field label="Tax rate (%)">{(p) => <Input type="number" min={0} max={100} step="any" {...p} {...register("taxRatePercent")} />}</Field>
        <Field label="Due date">{(p) => <Input type="date" {...p} {...register("dueDate")} />}</Field>
      </div>
      <Field label="Notes">{(p) => <Input {...p} {...register("notes")} />}</Field>
      <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" {...register("issue")} />Issue now and notify the patient (otherwise saved as draft)</label>
      <p className="rounded-control bg-primary-soft p-3 font-bold">Estimated total: {formatMoney(total)}</p>
      <div className="flex justify-end"><Button type="submit" loading={submitting}>Create invoice</Button></div>
    </form>
  );
}
