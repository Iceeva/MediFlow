"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardBody, CardHeader } from "../ui/card";
import { Field, Input } from "../ui/form";
import { passwordSchema } from "@/features/auth/schemas";
import { useApiMutation, useList } from "@/hooks/use-api";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";

const schema = z.object({ currentPassword: z.string().min(1, "Required"), newPassword: passwordSchema });

interface Sess { id: string; ip: string | null; userAgent: string | null; lastUsedAt: string; current: boolean }

export function SecurityPanel() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const sessions = useList<Sess>("/auth/sessions");
  const change = useApiMutation({ run: (v: z.infer<typeof schema>) => api("/auth/password", { json: v }), invalidate: ["/auth/sessions"], success: "Password changed. Other devices were signed out.", onDone: () => reset() });
  const revoke = useApiMutation({ run: (id: string) => api(`/auth/sessions/${id}`, { method: "DELETE" }), invalidate: ["/auth/sessions"], success: "Session signed out" });
  const revokeOthers = useApiMutation({ run: () => api("/auth/sessions", { method: "DELETE" }), invalidate: ["/auth/sessions"], success: "Signed out everywhere else" });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Change password" />
        <CardBody>
          <form onSubmit={handleSubmit((v) => change.mutate(v))} className="space-y-3" noValidate>
            <Field label="Current password" error={errors.currentPassword?.message}>{(p) => <Input type="password" autoComplete="current-password" {...p} {...register("currentPassword")} />}</Field>
            <Field label="New password" error={errors.newPassword?.message} hint="10+ characters with upper case, lower case and a digit">{(p) => <Input type="password" autoComplete="new-password" {...p} {...register("newPassword")} />}</Field>
            <Button type="submit" loading={change.isPending}>Change password</Button>
          </form>
          <p className="mt-4 text-sm text-muted">Two-factor authentication (TOTP) is not implemented yet.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Active sessions" action={<Button size="sm" variant="secondary" onClick={() => revokeOthers.mutate(undefined)} loading={revokeOthers.isPending}>Sign out other devices</Button>} />
        <ul className="divide-y divide-line">
          {sessions.rows?.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0"><p className="truncate font-bold">{s.userAgent?.slice(0, 60) || "Unknown device"} {s.current && <Badge tone="primary">this device</Badge>}</p><p className="text-sm text-muted">{s.ip ?? "unknown IP"} - last active {formatDateTime(s.lastUsedAt)}</p></div>
              {!s.current && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)}>Sign out</Button>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
