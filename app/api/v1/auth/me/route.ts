import { route } from "@/lib/api";
import { ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

export const GET = route({}, async ({ auth }) => {
  const [user, tenant] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { id: true, email: true, firstName: true, lastName: true, phone: true, emailVerifiedAt: true } }),
    auth.tenantId ? prisma.tenant.findUnique({ where: { id: auth.tenantId }, select: { id: true, name: true, slug: true } }) : null,
  ]);
  return ok({ user, tenant, role: auth.role, doctorId: auth.doctorId, patientId: auth.patientId, permissions: ROLE_PERMISSIONS[auth.role] });
});
