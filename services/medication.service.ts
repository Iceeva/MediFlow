import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { requireTenantId } from "@/lib/tenant";
import { orderBy, pageArgs, type Pagination } from "@/lib/http";
import type { AuthContext } from "@/lib/session";

export async function listMedications(auth: AuthContext, p: Pagination, f: { status?: "ACTIVE" | "DISCONTINUED"; dosageForm?: string }) {
  const where: Prisma.MedicationWhereInput = {
    tenantId: requireTenantId(auth),
    ...(f.status ? { status: f.status } : {}),
    ...(f.dosageForm ? { dosageForm: { equals: f.dosageForm, mode: "insensitive" } } : {}),
    ...(p.q ? { OR: [{ name: { contains: p.q, mode: "insensitive" } }, { genericName: { contains: p.q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.medication.findMany({ where, orderBy: orderBy(p, ["name", "genericName", "createdAt"] as const, "name"), ...pageArgs(p) }),
    prisma.medication.count({ where }),
  ]);
  return { items, total };
}

export async function updateMedication(auth: AuthContext, id: string, data: Prisma.MedicationUpdateInput) {
  const tenantId = requireTenantId(auth);
  if (!(await prisma.medication.findFirst({ where: { id, tenantId }, select: { id: true } }))) throw notFound("Medication not found");
  return prisma.medication.update({ where: { id }, data });
}
