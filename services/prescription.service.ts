import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/errors";
import { requireTenantId } from "@/lib/tenant";
import { pageArgs, type Pagination } from "@/lib/http";
import { nextNumber } from "@/lib/sequence";
import type { AuthContext } from "@/lib/session";
import type { CreatePrescriptionInput } from "@/features/prescriptions/schemas";
import { clinicalWhere, patientWhere } from "./scope";
import { notify } from "./notification.service";

const select = {
  id: true, number: true, notes: true, issuedAt: true, consultationId: true,
  patient: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true } },
  doctor: { select: { id: true, specialization: true, licenseNumber: true, user: { select: { firstName: true, lastName: true } } } },
  items: true,
} satisfies Prisma.PrescriptionSelect;

export async function listPrescriptions(auth: AuthContext, p: Pagination, patientId?: string) {
  const where: Prisma.PrescriptionWhereInput = { ...clinicalWhere(auth), ...(patientId ? { patientId } : {}) };
  const [items, total] = await Promise.all([
    prisma.prescription.findMany({ where, select, orderBy: { issuedAt: p.order }, ...pageArgs(p) }),
    prisma.prescription.count({ where }),
  ]);
  return { items, total };
}

export async function getPrescription(auth: AuthContext, id: string) {
  const row = await prisma.prescription.findFirst({ where: { AND: [clinicalWhere(auth), { id }] }, select });
  if (!row) throw notFound("Prescription not found");
  return row;
}

export async function createPrescription(auth: AuthContext, input: CreatePrescriptionInput) {
  const tenantId = requireTenantId(auth);
  if (!auth.doctorId) throw forbidden("Only doctors can issue prescriptions");
  const patient = await prisma.patient.findFirst({ where: { AND: [patientWhere(auth), { id: input.patientId }] }, select: { id: true, userId: true } });
  if (!patient) throw notFound("Patient not found");

  const medIds = input.items.map((i) => i.medicationId).filter((x): x is string => !!x);
  const meds = medIds.length ? await prisma.medication.findMany({ where: { id: { in: medIds }, tenantId, status: "ACTIVE" } }) : [];
  if (meds.length !== new Set(medIds).size) throw notFound("One of the selected medications does not exist or is discontinued");

  if (input.consultationId) {
    const c = await prisma.consultation.findFirst({ where: { id: input.consultationId, tenantId, patientId: patient.id }, select: { id: true } });
    if (!c) throw notFound("Consultation not found for this patient");
  }

  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, tenantId, "prescription", "RX");
    const rx = await tx.prescription.create({
      data: {
        tenantId, number, patientId: patient.id, doctorId: auth.doctorId!, consultationId: input.consultationId, notes: input.notes,
        items: { create: input.items.map(({ medicationId, ...i }) => ({ ...i, ...(medicationId ? { medicationId } : {}) })) },
      },
      select,
    });
    await notify({ tenantId, userId: patient.userId, type: "PRESCRIPTION_ISSUED", title: "New prescription", message: `Prescription ${number} is available.`, metadata: { prescriptionId: rx.id } }, tx);
    return rx;
  });
}
