import { route } from "@/lib/api";
import { created, paged, parseBody, parseQuery } from "@/lib/http";
import { createAppointmentSchema, listAppointmentsSchema } from "@/features/appointments/schemas";
import { createAppointment, listAppointments } from "@/services/appointment.service";

export const GET = route({ permission: "appointment:read" }, async ({ auth, query }) => {
  const f = parseQuery(query, listAppointmentsSchema);
  const { items, total } = await listAppointments(auth, f);
  return paged(items, total, { page: f.page, pageSize: f.pageSize, order: f.order });
});

export const POST = route({ permission: ["appointment:write", "appointment:book"] }, async ({ req, auth, audit }) => {
  const input = await parseBody(req, createAppointmentSchema);
  const appt = await createAppointment(auth, input);
  await audit("appointment.create", "appointment", appt.id);
  return created(appt);
});
