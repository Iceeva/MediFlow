import { route } from "@/lib/api";
import { created, parseBody } from "@/lib/http";
import { createVitalSchema } from "@/features/consultations/schemas";
import { recordVital } from "@/services/consultation.service";

// Nurses record vitals at intake, doctors during the consultation.
export const POST = route({ permission: "vital:write" }, async ({ req, auth, audit }) => {
  const input = await parseBody(req, createVitalSchema);
  const v = await recordVital(auth, input);
  await audit("vital.create", "vital", v.id, { patientId: input.patientId });
  return created(v);
});
