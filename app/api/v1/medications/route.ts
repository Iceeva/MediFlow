import { z } from "zod";
import { route } from "@/lib/api";
import { created, paged, paginationSchema, parseBody, parseQuery } from "@/lib/http";
import { medicationSchema } from "@/features/prescriptions/schemas";
import { listMedications } from "@/services/medication.service";
import { prisma } from "@/lib/prisma";
import { requireTenantId } from "@/lib/tenant";

const querySchema = paginationSchema.extend({ status: z.enum(["ACTIVE", "DISCONTINUED"]).optional(), dosageForm: z.string().max(60).optional() });

export const GET = route({ permission: "medication:read" }, async ({ auth, query }) => {
  const p = parseQuery(query, querySchema);
  const { items, total } = await listMedications(auth, p, p);
  return paged(items, total, p);
});

export const POST = route({ permission: "medication:manage" }, async ({ req, auth, audit }) => {
  const input = await parseBody(req, medicationSchema);
  const med = await prisma.medication.create({ data: { ...input, tenantId: requireTenantId(auth) } });
  await audit("medication.create", "medication", med.id);
  return created(med);
});
