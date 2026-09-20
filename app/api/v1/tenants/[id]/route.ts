import { route } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { updateTenantSchema } from "@/features/users/schemas";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/errors";

export const PATCH = route<{ id: string }>({ permission: ["tenant:manage", "user:manage"] }, async ({ req, auth, params, audit }) => {
  const { status, ...profile } = await parseBody(req, updateTenantSchema);
  const isSuper = auth.role === "SUPER_ADMIN";
  // A clinic admin may only edit their own clinic's profile and can never change its status.
  if (!isSuper && (params.id !== auth.tenantId || status)) throw forbidden();
  const exists = await prisma.tenant.findFirst({ where: { id: params.id, deletedAt: null }, select: { id: true } });
  if (!exists) throw notFound("Clinic not found");
  const updated = await prisma.tenant.update({ where: { id: params.id }, data: { ...profile, ...(isSuper && status ? { status } : {}) }, select: { id: true, name: true, status: true } });
  await audit("tenant.update", "tenant", params.id, { fields: [...Object.keys(profile), ...(status ? ["status"] : [])] });
  return ok(updated);
});
