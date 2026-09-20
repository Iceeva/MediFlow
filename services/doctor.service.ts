import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/errors";
import { requireTenantId } from "@/lib/tenant";
import { pageArgs, type Pagination } from "@/lib/http";
import type { AuthContext } from "@/lib/session";
import { can } from "@/lib/permissions";

const select = {
  id: true, specialization: true, licenseNumber: true, phone: true, consultationFee: true, status: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  availability: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
} satisfies Prisma.DoctorSelect;

export async function listDoctors(auth: AuthContext, p: Pagination, specialization?: string) {
  const where: Prisma.DoctorWhereInput = {
    tenantId: requireTenantId(auth), deletedAt: null,
    ...(specialization ? { specialization: { contains: specialization, mode: "insensitive" } } : {}),
    ...(p.q ? { OR: [{ specialization: { contains: p.q, mode: "insensitive" } }, { user: { OR: [{ firstName: { contains: p.q, mode: "insensitive" } }, { lastName: { contains: p.q, mode: "insensitive" } }] } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.doctor.findMany({ where, select, orderBy: { user: { lastName: "asc" } }, ...pageArgs(p) }),
    prisma.doctor.count({ where }),
  ]);
  // Fees are visible to patients and staff, but license numbers only to staff.
  const items = rows.map((d) => (auth.role === "PATIENT" ? { ...d, licenseNumber: undefined, phone: undefined } : d));
  return { items, total };
}

export async function getDoctor(auth: AuthContext, id: string) {
  const tenantId = requireTenantId(auth);
  const doctor = await prisma.doctor.findFirst({ where: { id, tenantId, deletedAt: null }, select });
  if (!doctor) throw notFound("Doctor not found");
  const [upcoming, patients, completed] = await Promise.all([
    prisma.appointment.count({ where: { tenantId, doctorId: id, startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.appointment.findMany({ where: { tenantId, doctorId: id }, distinct: ["patientId"], select: { patientId: true } }).then((r) => r.length),
    prisma.consultation.count({ where: { tenantId, doctorId: id } }),
  ]);
  return { ...doctor, stats: { upcomingAppointments: upcoming, patients, consultations: completed } };
}

export async function updateDoctor(auth: AuthContext, id: string, data: Prisma.DoctorUpdateInput) {
  const tenantId = requireTenantId(auth);
  const doctor = await prisma.doctor.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
  if (!doctor) throw notFound("Doctor not found");
  return prisma.doctor.update({ where: { id }, data, select });
}

export async function replaceAvailability(auth: AuthContext, id: string, slots: { dayOfWeek: number; startTime: string; endTime: string }[]) {
  const tenantId = requireTenantId(auth);
  // Admins manage anyone, a doctor manages only their own agenda.
  if (!can(auth.role, "doctor:manage") && auth.doctorId !== id) throw forbidden();
  const doctor = await prisma.doctor.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
  if (!doctor) throw notFound("Doctor not found");
  await prisma.$transaction([
    prisma.doctorAvailability.deleteMany({ where: { doctorId: id } }),
    prisma.doctorAvailability.createMany({ data: slots.map((s) => ({ ...s, doctorId: id })) }),
  ]);
  return getDoctor(auth, id);
}
