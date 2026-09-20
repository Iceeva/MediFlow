import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { requireTenantId } from "@/lib/tenant";
import { localParts } from "@/lib/time";
import type { AuthContext } from "@/lib/session";
import { TRANSITIONS, type AppointmentStatusValue } from "@/features/appointments/schemas";
import { appointmentWhere } from "./scope";
import { notify } from "./notification.service";

const ACTIVE: AppointmentStatusValue[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"];

const select = {
  id: true, startsAt: true, endsAt: true, reason: true, notes: true, status: true, createdAt: true,
  patient: { select: { id: true, firstName: true, lastName: true } },
  doctor: { select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } } },
  consultation: { select: { id: true } },
} satisfies Prisma.AppointmentSelect;

export interface AppointmentFilters { from?: Date; to?: Date; doctorId?: string; patientId?: string; status?: AppointmentStatusValue; page: number; pageSize: number; order: "asc" | "desc" }

export async function listAppointments(auth: AuthContext, f: AppointmentFilters) {
  const where: Prisma.AppointmentWhereInput = {
    AND: [
      appointmentWhere(auth),
      f.from || f.to ? { startsAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {},
      f.doctorId ? { doctorId: f.doctorId } : {},
      f.patientId ? { patientId: f.patientId } : {},
      f.status ? { status: f.status } : {},
    ],
  };
  const [items, total] = await Promise.all([
    prisma.appointment.findMany({ where, select, orderBy: { startsAt: f.order }, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
    prisma.appointment.count({ where }),
  ]);
  return { items, total };
}

export async function getAppointment(auth: AuthContext, id: string) {
  const row = await prisma.appointment.findFirst({ where: { AND: [appointmentWhere(auth), { id }] }, select });
  if (!row) throw notFound("Appointment not found");
  return row;
}

/** Runs `fn` in a SERIALIZABLE transaction, retrying on serialization failures (P2034). */
async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034" && i < attempts) continue;
      throw e;
    }
  }
}

async function assertSlotFree(tx: Prisma.TransactionClient, p: { tenantId: string; doctorId: string; patientId: string; startsAt: Date; endsAt: Date; excludeId?: string }) {
  const overlap = { startsAt: { lt: p.endsAt }, endsAt: { gt: p.startsAt }, status: { in: ACTIVE }, ...(p.excludeId ? { id: { not: p.excludeId } } : {}) };
  const [doctorBusy, patientBusy] = await Promise.all([
    tx.appointment.findFirst({ where: { tenantId: p.tenantId, doctorId: p.doctorId, ...overlap }, select: { id: true } }),
    tx.appointment.findFirst({ where: { tenantId: p.tenantId, patientId: p.patientId, ...overlap }, select: { id: true } }),
  ]);
  if (doctorBusy) throw conflict("The doctor already has an appointment during this time");
  if (patientBusy) throw conflict("The patient already has an appointment during this time");
}

async function assertWithinAvailability(tx: Prisma.TransactionClient, tenantId: string, doctorId: string, startsAt: Date, endsAt: Date) {
  const [slots, tenant] = await Promise.all([
    tx.doctorAvailability.findMany({ where: { doctorId } }),
    tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { timezone: true } }),
  ]);
  if (slots.length === 0) return; // no agenda defined yet: any time is accepted
  const s = localParts(startsAt, tenant.timezone);
  const e = localParts(endsAt, tenant.timezone);
  const fits = s.dayOfWeek === e.dayOfWeek && slots.some((a) => a.dayOfWeek === s.dayOfWeek && a.startTime <= s.time && a.endTime >= e.time);
  if (!fits) throw badRequest("The doctor is not available at this time");
}

export async function createAppointment(
  auth: AuthContext,
  input: { patientId?: string; doctorId: string; startsAt: Date; endsAt: Date; reason?: string; notes?: string },
) {
  const tenantId = requireTenantId(auth);
  let patientId: string;
  if (auth.role === "PATIENT") {
    if (!auth.patientId) throw forbidden("No patient record is linked to this account");
    patientId = auth.patientId; // patients can only book for themselves
  } else {
    if (!input.patientId) throw badRequest("patientId is required");
    patientId = input.patientId;
    // A doctor can only book into their own agenda.
    if (auth.role === "DOCTOR" && input.doctorId !== auth.doctorId) throw forbidden("Doctors can only schedule their own appointments");
  }

  const created = await serializable(async (tx) => {
    const [patient, doctor] = await Promise.all([
      tx.patient.findFirst({ where: { id: patientId, tenantId, deletedAt: null, archivedAt: null }, select: { id: true, userId: true, firstName: true } }),
      tx.doctor.findFirst({ where: { id: input.doctorId, tenantId, deletedAt: null, status: "ACTIVE" }, select: { id: true, userId: true } }),
    ]);
    if (!patient) throw notFound("Patient not found");
    if (!doctor) throw notFound("Doctor not found or not available");
    await assertWithinAvailability(tx, tenantId, doctor.id, input.startsAt, input.endsAt);
    await assertSlotFree(tx, { tenantId, doctorId: doctor.id, patientId, startsAt: input.startsAt, endsAt: input.endsAt });
    const appt = await tx.appointment.create({
      data: { tenantId, patientId, doctorId: doctor.id, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason, notes: input.notes, status: auth.role === "PATIENT" ? "PENDING" : "CONFIRMED", createdById: auth.userId },
      select,
    });
    const when = input.startsAt.toISOString();
    await notify({ tenantId, userId: doctor.userId, type: "APPOINTMENT_CREATED", title: "New appointment", message: `${patient.firstName} is booked for ${when}.`, metadata: { appointmentId: appt.id } }, tx);
    await notify({ tenantId, userId: patient.userId, type: "APPOINTMENT_CREATED", title: "Appointment booked", message: `Your appointment is scheduled for ${when}.`, metadata: { appointmentId: appt.id } }, tx);
    return appt;
  });
  return created;
}

export async function updateAppointment(
  auth: AuthContext,
  id: string,
  patch: { status?: AppointmentStatusValue; startsAt?: Date; endsAt?: Date; reason?: string; notes?: string },
) {
  const tenantId = requireTenantId(auth);
  const current = await prisma.appointment.findFirst({ where: { AND: [appointmentWhere(auth), { id }] }, select: { id: true, status: true, doctorId: true, patientId: true, startsAt: true, endsAt: true, patient: { select: { userId: true } }, doctor: { select: { userId: true } } } });
  if (!current) throw notFound("Appointment not found");

  if (auth.role === "PATIENT") {
    // Patients may only cancel, and only before the visit starts.
    const onlyCancel = patch.status === "CANCELLED" && !patch.startsAt && !patch.reason && !patch.notes;
    if (!onlyCancel) throw forbidden("Patients can only cancel their own appointments");
    if (current.startsAt < new Date()) throw badRequest("This appointment has already started");
  }
  if (patch.status && patch.status !== current.status) {
    if (!TRANSITIONS[current.status as AppointmentStatusValue].includes(patch.status)) {
      throw badRequest(`Cannot change status from ${current.status} to ${patch.status}`);
    }
  }
  if ((patch.startsAt || patch.reason || patch.notes) && !ACTIVE.includes(current.status as AppointmentStatusValue)) {
    throw badRequest("Closed appointments cannot be edited");
  }

  return serializable(async (tx) => {
    if (patch.startsAt && patch.endsAt) {
      if (patch.endsAt <= patch.startsAt) throw badRequest("End must be after start");
      await assertWithinAvailability(tx, tenantId, current.doctorId, patch.startsAt, patch.endsAt);
      await assertSlotFree(tx, { tenantId, doctorId: current.doctorId, patientId: current.patientId, startsAt: patch.startsAt, endsAt: patch.endsAt, excludeId: id });
    }
    const updated = await tx.appointment.update({
      where: { id },
      data: { ...patch, ...(patch.status === "CANCELLED" ? { cancelledAt: new Date() } : {}) },
      select,
    });
    if (patch.status || patch.startsAt) {
      const message = patch.status ? `Appointment status is now ${patch.status}.` : "Your appointment was rescheduled.";
      await notify({ tenantId, userId: current.patient.userId, type: "APPOINTMENT_UPDATED", title: "Appointment updated", message, metadata: { appointmentId: id } }, tx);
      await notify({ tenantId, userId: current.doctor.userId, type: "APPOINTMENT_UPDATED", title: "Appointment updated", message, metadata: { appointmentId: id } }, tx);
    }
    return updated;
  });
}
