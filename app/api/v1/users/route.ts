import { z } from "zod";
import { route } from "@/lib/api";
import { created, paged, paginationSchema, parseBody, parseQuery } from "@/lib/http";
import { createUserSchema } from "@/features/users/schemas";
import { createStaffUser, listTenantUsers } from "@/services/user.service";
import { requireTenantId } from "@/lib/tenant";
import { forbidden, badRequest } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const querySchema = paginationSchema.extend({ role: z.enum(["CLINIC_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ACCOUNTANT", "PATIENT"]).optional() });

export const GET = route({ permission: "user:read" }, async ({ query, auth }) => {
  const p = parseQuery(query, querySchema);
  const { items, total } = await listTenantUsers(requireTenantId(auth), p, p.role);
  return paged(items, total, p);
});

export const POST = route({ permission: "user:manage" }, async ({ req, auth, audit }) => {
  const input = await parseBody(req, createUserSchema);
  let tenantId: string;
  if (auth.role === "SUPER_ADMIN") {
    // The one place a tenantId is accepted from the client: only a super admin may name a tenant,
    // and only to bootstrap that clinic's administrator.
    if (input.role !== "CLINIC_ADMIN") throw forbidden("Super admins can only create clinic administrators");
    if (!input.tenantId) throw badRequest("tenantId is required");
    if (!(await prisma.tenant.findFirst({ where: { id: input.tenantId, deletedAt: null }, select: { id: true } }))) throw badRequest("Unknown tenant");
    tenantId = input.tenantId;
  } else {
    tenantId = requireTenantId(auth);
  }
  const user = await createStaffUser(tenantId, input);
  await audit("user.create", "user", user.id, { role: input.role });
  return created(user);
});
