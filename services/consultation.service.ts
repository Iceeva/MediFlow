import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { requireTenantId } from "@/lib/tenant";
import { pageArgs, type Pagination } from "@/lib/http";
import type { AuthContext } from "@/lib/session";
import { clinicalWhere } from "./scope";
import { patientWhere } from "./scope";

const select = {
  id: true, appointmentId: true, symptoms: true, diagnosis: true, observations: true, treatment: true, notes: true, followUpAt: true, createdAt: true, updatedAt: true,
  patient: { select: { id: true, firstName: true, lastName: true } },
  doctor: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  vitals: { orderBy: { recordedAt: "desc" as const } },
} satisfies Prisma.ConsultationSelect;

export async function listConsultations(auth: AuthContext, p: Pagination, patientId?: string) {
  const where: Prisma.ConsultationWhereInput = { ...clinicalWhere(auth), ...(patientId ? { patientId } : {}) };
  const [items, total] = await Promise.all([
    prisma.consultation.findMany({ where, select, orderBy: { createdAt: p.order }, ...pageArgs(p) }),
    prisma.consultation.count({ where }),
  ]);
  return { items, total };
}

export async function getConsultation(auth: AuthContext, id: string) {
  const row = await prisma.consultation.findFirst({ where: { AND: [clinicalWhere(auth), { id }] }, select });
  if (!row) throw notFound("Consultation not found");
  return row;
}

/** Workflow: Patient -> Appointment -> Consultation. Only the appointment's doctor can open the consultation. */
export async function createConsultation(auth: AuthContext, input: { appointmentId: string; followUpAt?: Date; vitals?: Prisma.VitalCreateWithoutTenantInput | Record<string, number | undefined> } & Record<string, unknown>) {
  const tenantId = requireTenantId(auth);
  if (!auth.doctorId) throw forbidden("Only doctors can record consultations");
  const { appointmentId, vitals, ...fields } = input;
  const appt = await prisma.appointment.findFirst({ where: { id: appointmentId, tenantId }, select: { id: true, doctorId: true, patientId: true, status: true } });
  if (!appt) throw notFound("Appointment not found");
  if (appt.doctorId !== auth.doctorId) throw forbidden("This appointment belongs to another doctor");
  if (!["CHECKED_IN", "IN_PROGRESS", "CONFIRMED"].includes(appt.status)) throw badRequest(`A consultation cannot start from an appointment in status ${appt.status}`);
  if (await prisma.consultation.findUnique({ where: { appointmentId }, select: { id: true } })) throw conflict("This appointment already has a consultation");

  return prisma.$transaction(async (tx) => {
    const c = await tx.consultation.create({
      data: { tenantId, appointmentId, patientId: appt.patientId, doctorId: appt.doctorId, ...(fields as object) },
      select: { id: true },
    });
    if (vitals && Object.values(vitals).some((v) => v !== undefined)) {
      await tx.vital.create({ data: { ...(vitals as object), tenantId, patientId: appt.patientId, consultationId: c.id, recordedById: auth.userId } });
    }
    await tx.appointment.update({ where: { id: appointmentId }, data: { status: "IN_PROGRESS" } });
    return tx.consultation.findUniqueOrThrow({ where: { id: c.id }, select });
  });
}

export async function updateConsultation(auth: AuthContext, id: string, data: Prisma.ConsultationUpdateInput) {
  const row = await prisma.consultation.findFirst({ where: { id, tenantId: requireTenantId(auth) }, select: { id: true, doctorId: true } });
  if (!row) throw notFound("Consultation not found");
  if (row.doctorId !== auth.doctorId) throw forbidden("Only the doctor who recorded this consultation can edit it");
  return prisma.consultation.update({ where: { id }, data, select });
}

export async function completeConsultation(auth: AuthContext, id: string) {
  const row = await getConsultation(auth, id);
  const full = await prisma.consultation.findUniqueOrThrow({ where: { id: row.id }, select: { doctorId: true, appointmentId: true } });
  if (full.doctorId !== auth.doctorId) throw forbidden();
  await prisma.appointment.update({ where: { id: full.appointmentId }, data: { status: "COMPLETED" } });
  return { id };
}

export async function recordVital(auth: AuthContext, input: { patientId: string; consultationId?: string } & Record<string, number | string | undefined>) {
  const tenantId = requireTenantId(auth);
  const patient = await prisma.patient.findFirst({ where: { AND: [patientWhere(auth), { id: input.patientId }] }, select: { id: true } });
  if (!patient) throw notFound("Patient not found");
  return prisma.vital.create({ data: { ...(input as object), tenantId, recordedById: auth.userId } as Prisma.VitalUncheckedCreateInput, select: { id: true, recordedAt: true } });
}
