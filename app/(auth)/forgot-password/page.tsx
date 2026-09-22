"use client";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ email: string }>();
  async function onSubmit(v: { email: string }) {
    setError(null);
    try { await api("/auth/forgot-password", { json: v }); setSent(true); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Something went wrong"); }
  }
  if (sent) return <div className="space-y-3"><h1>Check your inbox</h1><p>If an account exists for that address, we sent a link to choose a new password. It expires in one hour.</p><Link href="/login" className="font-bold text-primary underline">Back to sign in</Link></div>;
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h1>Reset your password</h1>
      {error && <p role="alert" className="font-bold text-danger">{error}</p>}
      <Field label="Email">{(p) => <Input type="email" required autoComplete="email" {...p} {...register("email", { required: true })} />}</Field>
      <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
      <Link href="/login" className="block text-sm font-bold text-primary underline">Back to sign in</Link>
    </form>
  );
}
