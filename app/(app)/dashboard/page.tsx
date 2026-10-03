import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/session";
import { dashboardFor } from "@/services/analytics.service";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/states";
import { SeriesChart, Stat } from "@/components/dashboard/widgets";
import { formatDate, formatDateTime, formatMoney, fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  const d = await dashboardFor(auth); // PostgreSQL via Prisma, scoped by role and tenant

  if (d.kind === "global") {
    return (
      <>
        <PageHeader title="Platform overview" description="Totals across all clinics." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Clinics" value={d.cards.tenants} /><Stat label="Users" value={d.cards.users} />
          <Stat label="Patients" value={d.cards.patients} /><Stat label="Appointments" value={d.cards.appointments} />
        </div>
      </>
    );
  }

  if (d.kind === "admin" || d.kind === "finance") {
    const c = d.cards;
    return (
      <>
        <PageHeader title="Dashboard" description="How the clinic is doing right now." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {d.kind === "admin" && <><Stat label="Patients" value={c.patients} /><Stat label="Doctors" value={c.doctors} /><Stat label="Appointments today" value={c.appointmentsToday} /><Stat label="Consultations this month" value={c.consultationsThisMonth} /></>}
          <Stat label="Revenue this month" value={formatMoney(c.revenueThisMonth)} />
          <Stat label="Outstanding invoices" value={formatMoney(c.outstandingInvoices)} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {d.kind === "admin" && <SeriesChart title="Appointments, last 14 days" data={d.series.appointments} />}
          <SeriesChart title="Revenue, last 30 days" data={d.series.revenue} kind="line" format={(n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))} />
          {d.kind === "admin" && <SeriesChart title="Consultations, last 14 days" data={d.series.consultations} />}
          {d.kind === "admin" && <SeriesChart title="New patients per month" data={d.series.patients} />}
        </div>
      </>
    );
  }

  if (d.kind === "doctor") {
    return (
      <>
        <PageHeader title="Your day" description="Appointments and patients that need you." />
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Today's appointments" value={d.cards.appointmentsToday} /><Stat label="Upcoming" value={d.cards.upcomingAppointments} /><Stat label="Patients" value={d.cards.patients} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Today" action={<Link href="/appointments" className="font-bold text-primary underline">Open agenda</Link>} />
            {d.today.length === 0 ? <EmptyState title="No appointments today" /> : (
              <ul className="divide-y divide-line">{d.today.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div><p className="font-bold">{fullName(a.patient)}</p><p className="text-sm text-muted">{formatDateTime(a.startsAt)}{a.reason ? ` - ${a.reason}` : ""}</p></div>
                  <StatusBadge status={a.status} />
                </li>))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Recent consultations" />
            {d.recentConsultations.length === 0 ? <EmptyState title="No consultations yet" /> : (
              <ul className="divide-y divide-line">{d.recentConsultations.map((c) => (
                <li key={c.id} className="px-5 py-3"><Link href={`/patients/${c.patient.id}`} className="font-bold underline-offset-2 hover:underline">{fullName(c.patient)}</Link><p className="text-sm text-muted">{formatDate(c.createdAt)} - {c.diagnosis ?? "No diagnosis recorded"}</p></li>))}
              </ul>
            )}
          </Card>
        </div>
      </>
    );
  }

  if (d.kind === "patient") {
    const n = d.nextAppointment;
    return (
      <>
        <PageHeader title="Your health space" description="Appointments, prescriptions, documents and bills in one place." />
        <Card className="mb-4">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            {n ? <div><p className="text-sm text-muted">Next appointment</p><p className="text-lg font-bold">{formatDateTime(n.startsAt)}</p><p>Dr {fullName(n.doctor.user)} - {n.doctor.specialization}</p></div>
               : <div><p className="font-bold">No upcoming appointment</p><p className="text-muted">Book a visit with one of the clinic&apos;s doctors.</p></div>}
            <Link href="/appointments" className="rounded-control bg-primary px-4 py-2 font-bold text-white">{n ? "View appointments" : "Book an appointment"}</Link>
          </CardBody>
        </Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Prescriptions" value={d.cards.prescriptions} /><Stat label="Documents" value={d.cards.documents} />
          <Stat label="Amount due" value={formatMoney(d.cards.amountDue)} hint={`${d.cards.unpaidInvoices} unpaid invoice(s)`} />
        </div>
        <Card className="mt-6">
          <CardHeader title="Medical history" description="Your last completed visits" />
          {d.history.length === 0 ? <EmptyState title="No completed visits yet" /> : (
            <ul className="divide-y divide-line">{d.history.map((h) => <li key={h.id} className="px-5 py-3"><p className="font-bold">{formatDate(h.startsAt)} with Dr {h.doctor.user.lastName}</p><p className="text-sm text-muted">{h.reason ?? "General visit"}</p></li>)}</ul>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Welcome, ${auth.name}`} description="Use the menu to open your work areas." />
      <EmptyState title="No dashboard widgets for your role" description="Your tools are in the navigation on the left." />
    </>
  );
}
