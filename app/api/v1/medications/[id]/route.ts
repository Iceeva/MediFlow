import { route } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { updateMedicationSchema } from "@/features/prescriptions/schemas";
import { updateMedication } from "@/services/medication.service";

export const PATCH = route<{ id: string }>({ permission: "medication:manage" }, async ({ req, auth, params, audit }) => {
  const data = await parseBody(req, updateMedicationSchema);
  const med = await updateMedication(auth, params.id, data);
  await audit("medication.update", "medication", params.id);
  return ok(med);
});

// Medications referenced by past prescriptions are never removed, only discontinued.
export const DELETE = route<{ id: string }>({ permission: "medication:manage" }, async ({ auth, params, audit }) => {
  const med = await updateMedication(auth, params.id, { status: "DISCONTINUED" });
  await audit("medication.discontinue", "medication", params.id);
  return ok(med);
});
