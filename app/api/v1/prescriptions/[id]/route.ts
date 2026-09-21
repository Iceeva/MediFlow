import { route } from "@/lib/api";
import { ok } from "@/lib/http";
import { getPrescription } from "@/services/prescription.service";

export const GET = route<{ id: string }>({ permission: "prescription:read" }, async ({ auth, params, audit }) => {
  const rx = await getPrescription(auth, params.id);
  await audit("prescription.view", "prescription", params.id);
  return ok(rx);
});
