import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { route } from "@/lib/api";
import { paged, paginationSchema, parseQuery } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const querySchema = paginationSchema.extend({
  userId: z.string().uuid().optional(),
  resource: z.string().max(60).optional(),
  action: z.string().max(80).optional(),
  result: z.enum(["SUCCESS", "DENIED", "FAILURE"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// Read-only by design: there is no POST, PATCH or PUT handler, so the API cannot alter or delete logs.
export const GET = route({ permission: "audit:read" }, async ({ auth, query }) => {
  const p = parseQuery(query, querySchema);
  const where: Prisma.AuditLogWhereInput = {
    // Clinic admins only see their own clinic. Super admins see platform-level events (no tenant) and all tenants.
    ...(auth.role === "SUPER_ADMIN" ? {} : { tenantId: auth.tenantId }),
    ...(p.userId ? { userId: p.userId } : {}),
    ...(p.resource ? { resource: p.resource } : {}),
    ...(p.action ? { action: { contains: p.action, mode: "insensitive" } } : {}),
    ...(p.result ? { result: p.result } : {}),
    ...(p.from || p.to ? { createdAt: { ...(p.from ? { gte: p.from } : {}), ...(p.to ? { lte: p.to } : {}) } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, orderBy: { createdAt: p.order }, skip: (p.page - 1) * p.pageSize, take: p.pageSize,
      select: { id: true, action: true, resource: true, resourceId: true, result: true, ip: true, userAgent: true, createdAt: true, metadata: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return paged(items, total, p);
});
