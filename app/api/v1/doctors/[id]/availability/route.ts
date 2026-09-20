import { route } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { availabilitySchema } from "@/features/doctors/schemas";
import { replaceAvailability } from "@/services/doctor.service";

export const PUT = route<{ id: string }>({ permission: ["doctor:manage", "appointment:write"] }, async ({ req, auth, params, audit }) => {
  const { slots } = await parseBody(req, availabilitySchema);
  const res = await replaceAvailability(auth, params.id, slots);
  await audit("doctor.availability.update", "doctor", params.id, { slots: slots.length });
  return ok(res);
});
