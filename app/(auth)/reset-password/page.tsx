"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiClientError } from "@/lib/client";
import { passwordSchema } from "@/features/auth/schemas";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

const schema = z.object({ password: passwordSchema });

function Form() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ password: string }>({ resolver: zodResolver(schema) });
  async function onSubmit(v: { password: string }) {
    setError(null);
    try { await api("/auth/reset-password", { json: { token, password: v.password } }); setDone(true); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Something went wrong"); }
  }
  if (done) return <div className="space-y-3"><h1>Password updated</h1><p>You were signed out everywhere. Sign in with your new password.</p><Link href="/login" className="font-bold text-primary underline">Go to sign in</Link></div>;
  if (!token) return <div className="space-y-3"><h1>This link is incomplete</h1><Link href="/forgot-password" className="font-bold text-primary underline">Request a new link</Link></div>;
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <h1>Choose a new password</h1>
      {error && <p role="alert" className="font-bold text-danger">{error}</p>}
      <Field label="New password" error={errors.password?.message} hint="10+ characters with upper case, lower case and a digit">{(p) => <Input type="password" autoComplete="new-password" {...p} {...register("password")} />}</Field>
      <Button type="submit" className="w-full" loading={isSubmitting}>Save password</Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><Form /></Suspense>;
}
