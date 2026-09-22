"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiClientError } from "@/lib/client";
import { passwordSchema } from "@/features/auth/schemas";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

const schema = z.object({
  firstName: z.string().min(1, "Required"), lastName: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"), password: passwordSchema,
  clinicName: z.string().optional(), clinicSlug: z.string().min(3, "At least 3 characters"), dateOfBirth: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [type, setType] = useState<"patient" | "clinic">("patient");
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(v: Values) {
    setError(null);
    if (type === "clinic" && !v.clinicName) return setFieldError("clinicName", { message: "Required" });
    if (type === "patient" && !v.dateOfBirth) return setFieldError("dateOfBirth", { message: "Required" });
    try {
      await api("/auth/register", { json: { type, ...v } });
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError && e.details?.fieldErrors) {
        for (const [k, msgs] of Object.entries(e.details.fieldErrors)) setFieldError(k as keyof Values, { message: msgs?.[0] });
      }
      setError(e instanceof ApiClientError ? e.message : "Could not create the account");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <h1>Create your account</h1>
      <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-1 rounded-control border border-line bg-paper p-1">
        {(["patient", "clinic"] as const).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)}
            className={cn("rounded-control py-2 font-bold", type === t ? "bg-surface shadow-sm" : "text-muted")}>{t === "patient" ? "I am a patient" : "I run a clinic"}</button>
        ))}
      </div>
      {error && <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft p-3 font-bold text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={errors.firstName?.message}>{(p) => <Input autoComplete="given-name" {...p} {...register("firstName")} />}</Field>
        <Field label="Last name" error={errors.lastName?.message}>{(p) => <Input autoComplete="family-name" {...p} {...register("lastName")} />}</Field>
      </div>
      <Field label="Email" error={errors.email?.message}>{(p) => <Input type="email" autoComplete="email" {...p} {...register("email")} />}</Field>
      <Field label="Password" error={errors.password?.message} hint="10+ characters with upper case, lower case and a digit">{(p) => <Input type="password" autoComplete="new-password" {...p} {...register("password")} />}</Field>
      {type === "clinic" && <Field label="Clinic name" error={errors.clinicName?.message}>{(p) => <Input {...p} {...register("clinicName")} />}</Field>}
      <Field label={type === "clinic" ? "Clinic address (short name)" : "Clinic you attend (its short name)"} error={errors.clinicSlug?.message} hint="Lowercase letters, digits and dashes, for example demo-clinic">{(p) => <Input autoComplete="off" {...p} {...register("clinicSlug")} />}</Field>
      {type === "patient" && <Field label="Date of birth" error={errors.dateOfBirth?.message}>{(p) => <Input type="date" max={new Date().toISOString().slice(0, 10)} {...p} {...register("dateOfBirth")} />}</Field>}
      <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
      <p className="text-sm">Already registered? <Link href="/login" className="font-bold text-primary underline">Sign in</Link></p>
    </form>
  );
}
