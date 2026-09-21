import { prisma } from "@/lib/prisma";
import { requireTenantId } from "@/lib/tenant";
import { startOfUtcDay } from "@/lib/time";
import type { AuthContext } from "@/lib/session";

const day = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(startOfUtcDay().getTime() - n * 86_400_000);

type Point = { date: string; value: number };

/** Fills missing days with 0 so charts have a continuous axis. */
function fill(rows: { day: Date; v: number }[], days: number): Point[] {
  const map = new Map(rows.map((r) => [day(r.day), r.v]));
  return Array.from({ length: days }, (_, i) => {
    const date = day(daysAgo(days - 1 - i));
    return { date, value: map.get(date) ?? 0 };
  });
}

async function clinicSeries(tenantId: string) {
  const from14 = daysAgo(13);
  const from30 = daysAgo(29);
  const from180 = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5, 1));
  const [appts, revenue, patients, consults] = await Promise.all([
    prisma.$queryRaw<{ day: Date; v: number }[]>`SELECT date_trunc('day',"startsAt")::date AS day, count(*)::int AS v FROM "Appointment" WHERE "tenantId" = ${tenantId}::uuid AND "startsAt" >= ${from14} GROUP BY 1`,
    prisma.$queryRaw<{ day: Date; v: number }[]>`SELECT date_trunc('day',"paidAt")::date AS day, COALESCE(sum(amount),0)::float8 AS v FROM "Payment" WHERE "tenantId" = ${tenantId}::uuid AND status = 'SUCCEEDED' AND "paidAt" >= ${from30} GROUP BY 1`,
    prisma.$queryRaw<{ month: Date; v: number }[]>`SELECT date_trunc('month',"createdAt")::date AS month, count(*)::int AS v FROM "Patient" WHERE "tenantId" = ${tenantId}::uuid AND "createdAt" >= ${from180} AND "deletedAt" IS NULL GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ day: Date; v: number }[]>`SELECT date_trunc('day',"createdAt")::date AS day, count(*)::int AS v FROM "Consultation" WHERE "tenantId" = ${tenantId}::uuid AND "createdAt" >= ${from14} GROUP BY 1`,
  ]);
  return {
    appointments: fill(appts, 14),
    revenue: fill(revenue, 30),
    consultations: fill(consults, 14),
    patients: patients.map((r) => ({ date: day(r.month).slice(0, 7), value: r.v })),
  };
}

export async function adminDashboard(auth: AuthContext) {
  const tenantId = requireTenantId(auth);
  const today = startOfUtcDay();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const [patients, doctors, apptsToday, consultations, revenue, outstanding, series] = await Promise.all([
    prisma.patient.count({ where: { tenantId, deletedAt: null, archivedAt: null } }),
    prisma.doctor.count({ where: { tenantId, deletedAt: null, status: "ACTIVE" } }),
    prisma.appointment.count({ where: { tenantId, startsAt: { gte: today, lt: tomorrow } } }),
    prisma.consultation.count({ where: { tenantId, createdAt: { gte: monthStart } } }),
    prisma.payment.aggregate({ where: { tenantId, status: "SUCCEEDED", paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.$queryRaw<{ v: number }[]>`SELECT COALESCE(sum(total - "amountPaid"),0)::float8 AS v FROM "Invoice" WHERE "tenantId" = ${tenantId}::uuid AND status IN ('PENDING','PARTIALLY_PAID','OVERDUE')`,
    clinicSeries(tenantId),
  ]);
  return {
    kind: "admin" as const,
    cards: { patients, doctors, appointmentsToday: apptsToday, consultationsThisMonth: consultations, revenueThisMonth: Number(revenue._sum.amount ?? 0), outstandingInvoices: outstanding[0]?.v ?? 0 },
    series,
  };
}

export async function doctorDashboard(auth: AuthContext) {
  const tenantId = requireTenantId(auth);
  const doctorId = auth.doctorId ?? "none";
  const today = startOfUtcDay();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const [todays, upcoming, patients, recent] = await Promise.all([
    prisma.appointment.findMany({ where: { tenantId, doctorId, startsAt: { gte: today, lt: tomorrow } }, orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, endsAt: true, status: true, reason: true, patient: { select: { id: true, firstName: true, lastName: true } } } }),
    prisma.appointment.count({ where: { tenantId, doctorId, startsAt: { gte: tomorrow }, status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.appointment.findMany({ where: { tenantId, doctorId }, distinct: ["patientId"], select: { patientId: true } }).then((r) => r.length),
    prisma.consultation.findMany({ where: { tenantId, doctorId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, diagnosis: true, createdAt: true, patient: { select: { id: true, firstName: true, lastName: true } } } }),
  ]);
  return { kind: "doctor" as const, cards: { appointmentsToday: todays.length, upcomingAppointments: upcoming, patients }, today: todays, recentConsultations: recent };
}

export async function patientDashboard(auth: AuthContext) {
  const tenantId = requireTenantId(auth);
  const patientId = auth.patientId ?? "none";
  const [next, prescriptions, documents, invoices, history] = await Promise.all([
    prisma.appointment.findFirst({ where: { tenantId, patientId, startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } }, orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, reason: true, status: true, doctor: { select: { specialization: true, user: { select: { firstName: true, lastName: true } } } } } }),
    prisma.prescription.count({ where: { tenantId, patientId } }),
    prisma.medicalDocument.count({ where: { tenantId, patientId, deletedAt: null, accessPolicy: "PATIENT_VISIBLE" } }),
    prisma.invoice.findMany({ where: { tenantId, patientId, status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] } }, select: { total: true, amountPaid: true } }),
    prisma.appointment.findMany({ where: { tenantId, patientId, status: "COMPLETED" }, orderBy: { startsAt: "desc" }, take: 5, select: { id: true, startsAt: true, reason: true, doctor: { select: { user: { select: { lastName: true } } } } } }),
  ]);
  const due = invoices.reduce((a, i) => a + Number(i.total) - Number(i.amountPaid), 0);
  return { kind: "patient" as const, nextAppointment: next, cards: { prescriptions, documents, unpaidInvoices: invoices.length, amountDue: due }, history };
}

export async function financeDashboard(auth: AuthContext) {
  const base = await adminDashboard(auth);
  return { ...base, kind: "finance" as const };
}

export async function globalDashboard() {
  const [tenants, users, patients, appointments] = await Promise.all([
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.user.count(),
    prisma.patient.count({ where: { deletedAt: null } }),
    prisma.appointment.count(),
  ]);
  return { kind: "global" as const, cards: { tenants, users, patients, appointments } };
}

export async function dashboardFor(auth: AuthContext) {
  switch (auth.role) {
    case "SUPER_ADMIN": return globalDashboard();
    case "CLINIC_ADMIN": return adminDashboard(auth);
    case "DOCTOR": return doctorDashboard(auth);
    case "PATIENT": return patientDashboard(auth);
    case "ACCOUNTANT": return financeDashboard(auth);
    default: return { kind: "basic" as const, cards: {} }; // nurses and receptionists have no analytics dashboard
  }
}
