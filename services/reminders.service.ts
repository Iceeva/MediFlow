import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notify } from "./notification.service";
import { sendAppointmentReminderEmail } from "./email.service";

/**
 * Called once a day by Vercel Cron (see vercel.json). Idempotent: appointments get exactly one reminder
 * thanks to a metadata marker check, so a re-run or retry never double-sends. Also flips overdue invoices.
 */
export async function runDailyJobs(now = new Date()) {
  const from = new Date(now.getTime() + 12 * 3_600_000);
  const to = new Date(now.getTime() + 36 * 3_600_000);
  const appts = await prisma.appointment.findMany({
    where: { startsAt: { gte: from, lt: to }, status: { in: ["PENDING", "CONFIRMED"] } },
    select: { id: true, tenantId: true, startsAt: true, patient: { select: { userId: true, firstName: true, email: true } }, doctor: { select: { user: { select: { lastName: true } } } } },
    take: 1000,
  });

  let reminders = 0;
  for (const a of appts) {
    if (!a.patient.userId) continue;
    const already = await prisma.notification.findFirst({ where: { userId: a.patient.userId, type: "APPOINTMENT_REMINDER", metadata: { path: ["appointmentId"], equals: a.id } }, select: { id: true } });
    if (already) continue;
    await notify({ tenantId: a.tenantId, userId: a.patient.userId, type: "APPOINTMENT_REMINDER", title: "Appointment tomorrow", message: `Reminder: appointment on ${a.startsAt.toISOString()}.`, metadata: { appointmentId: a.id } });
    if (a.patient.email) await sendAppointmentReminderEmail(a.patient.email, a.patient.firstName, a.startsAt.toUTCString(), `Dr ${a.doctor.user.lastName}`);
    reminders++;
  }

  const overdue = await prisma.invoice.updateMany({ where: { status: { in: ["PENDING", "PARTIALLY_PAID"] }, dueDate: { lt: now } }, data: { status: "OVERDUE" } });
  const sessions = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } } });
  const tokens = await prisma.verificationToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86_400_000) } } });
  logger.info("daily_jobs_done", { reminders, overdue: overdue.count, sessions: sessions.count, tokens: tokens.count });
  return { reminders, overdueInvoices: overdue.count };
}
