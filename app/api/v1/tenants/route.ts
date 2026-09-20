import { route } from "@/lib/api";
import { created, ok, parseBody } from "@/lib/http";
import { createTenantSchema } from "@/features/users/schemas";
import { prisma } from "@/lib/prisma";
import { conflict } from "@/lib/errors";
import { createStaffUser } from "@/services/user.service";

// SUPER_ADMIN sees every clinic, everyone else sees only their own.
export const GET = route({}, async ({ auth }) => {
  const rows = await prisma.tenant.findMany({
    where: { deletedAt: null, ...(auth.role === "SUPER_ADMIN" ? {} : { id: auth.tenantId! }) },
    select: { id: true, name: true, slug: true, email: true, phone: true, address: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return ok(rows);
});

export const POST = route({ permission: "tenant:manage" }, async ({ req, audit }) => {
  const input = await parseBody(req, createTenantSchema);
  if (await prisma.tenant.findUnique({ where: { slug: input.slug }, select: { id: true } })) throw conflict("This clinic address is already taken");
  const tenant = await prisma.tenant.create({ data: { name: input.name, slug: input.slug, email: input.email, phone: input.phone, address: input.address, timezone: input.timezone } });
  const admin = await createStaffUser(tenant.id, { ...input.admin, role: "CLINIC_ADMIN" });
  await audit("tenant.create", "tenant", tenant.id, { adminId: admin.id });
  return created({ id: tenant.id, slug: tenant.slug, adminId: admin.id });
});
