import { route } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { updateAppointmentSchema } from "@/features/appointments/schemas";
import { getAppointment, updateAppointment } from "@/services/appointment.service";

export const GET = route<{ id: string }>({ permission: "appointment:read" }, async ({ auth, params }) => ok(await getAppointment(auth, params.id)));

// Patients are allowed to reach this handler (to cancel), the service restricts them to cancellation.
export const PATCH = route<{ id: string }>({ permission: ["appointment:write", "appointment:book"] }, async ({ req, auth, params, audit }) => {
  const patch = await parseBody(req, updateAppointmentSchema);
  const res = await updateAppointment(auth, params.id, patch);
  await audit("appointment.update", "appointment", params.id, { fields: Object.keys(patch), status: patch.status ?? null });
  return ok(res);
});
