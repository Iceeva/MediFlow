"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/form";

const schema = z.object({
  firstName: z.string().trim().min(1, "Required"), lastName: z.string().trim().min(1, "Required"),
  dateOfBirth: z.string().min(1, "Required"), gender: z.enum(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"]),
  phone: z.string().optional(), email: z.string().email("Enter a valid email").or(z.literal("")).optional(), address: z.string().optional(),
  emergencyContactName: z.string().optional(), emergencyContactPhone: z.string().optional(),
  bloodType: z.string().optional(), allergies: z.string().optional(), medicalHistory: z.string().optional(), currentMedications: z.string().optional(),
  insuranceProvider: z.string().optional(), insuranceNumber: z.string().optional(),
});
export type PatientFormValues = z.infer<typeof schema>;

export const toPayload = (v: PatientFormValues, clinical: boolean) => ({
  firstName: v.firstName, lastName: v.lastName, dateOfBirth: v.dateOfBirth, gender: v.gender,
  phone: v.phone, email: v.email, address: v.address, emergencyContactName: v.emergencyContactName, emergencyContactPhone: v.emergencyContactPhone,
  ...(clinical ? {
    bloodType: v.bloodType || undefined, allergies: (v.allergies ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    medicalHistory: v.medicalHistory, currentMedications: v.currentMedications, insuranceProvider: v.insuranceProvider, insuranceNumber: v.insuranceNumber,
  } : {}),
});

export function PatientForm({ initial, clinical, onSubmit, submitting }: { initial?: Partial<PatientFormValues>; clinical: boolean; onSubmit: (v: PatientFormValues) => void; submitting?: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<PatientFormValues>({ resolver: zodResolver(schema), defaultValues: { gender: "UNDISCLOSED", ...initial } });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName?.message}>{(p) => <Input {...p} {...register("firstName")} />}</Field>
        <Field label="Last name" error={errors.lastName?.message}>{(p) => <Input {...p} {...register("lastName")} />}</Field>
        <Field label="Date of birth" error={errors.dateOfBirth?.message}>{(p) => <Input type="date" max={new Date().toISOString().slice(0, 10)} {...p} {...register("dateOfBirth")} />}</Field>
        <Field label="Gender">{(p) => <Select {...p} {...register("gender")}><option value="UNDISCLOSED">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></Select>}</Field>
        <Field label="Phone">{(p) => <Input type="tel" {...p} {...register("phone")} />}</Field>
        <Field label="Email" error={errors.email?.message}>{(p) => <Input type="email" {...p} {...register("email")} />}</Field>
      </div>
      <Field label="Address">{(p) => <Input {...p} {...register("address")} />}</Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Emergency contact">{(p) => <Input {...p} {...register("emergencyContactName")} />}</Field>
        <Field label="Emergency contact phone">{(p) => <Input type="tel" {...p} {...register("emergencyContactPhone")} />}</Field>
      </div>
      {clinical && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Blood type">{(p) => <Select {...p} {...register("bloodType")}><option value="">Unknown</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => <option key={b}>{b}</option>)}</Select>}</Field>
            <Field label="Allergies" hint="Separate with commas">{(p) => <Input {...p} {...register("allergies")} />}</Field>
            <Field label="Insurance provider">{(p) => <Input {...p} {...register("insuranceProvider")} />}</Field>
            <Field label="Insurance number">{(p) => <Input {...p} {...register("insuranceNumber")} />}</Field>
          </div>
          <Field label="Medical history">{(p) => <Textarea {...p} {...register("medicalHistory")} />}</Field>
          <Field label="Current medications">{(p) => <Textarea {...p} {...register("currentMedications")} />}</Field>
        </>
      )}
      <div className="flex justify-end"><Button type="submit" loading={submitting}>Save patient</Button></div>
    </form>
  );
}
