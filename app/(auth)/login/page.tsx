"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiClientError } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

const schema = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(1, "Enter your password"), clinicSlug: z.string().optional() });
type Values = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(v: Values) {
    setError(null);
    try {
      await api("/auth/login", { json: { ...v, clinicSlug: v.clinicSlug || undefined } });
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not sign in");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <h1>Sign in</h1>
      {error && <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft p-3 font-bold text-danger">{error}</p>}
      <Field label="Email" error={errors.email?.message}>{(p) => <Input type="email" autoComplete="email" {...p} {...register("email")} />}</Field>
      <Field label="Password" error={errors.password?.message}>{(p) => <Input type="password" autoComplete="current-password" {...p} {...register("password")} />}</Field>
      <Field label="Clinic address (optional)" hint="Only needed if you belong to several clinics">{(p) => <Input autoComplete="off" placeholder="demo-clinic" {...p} {...register("clinicSlug")} />}</Field>
      <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
      <p className="flex justify-between text-sm">
        <Link href="/forgot-password" className="font-bold text-primary underline">Forgot password?</Link>
        <Link href="/register" className="font-bold text-primary underline">Create an account</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
