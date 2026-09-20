import { z } from "zod";
import { route } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { updateConsultationSchema } from "@/features/consultations/schemas";
import { completeConsultation, getConsultation, updateConsultation } from "@/services/consultation.service";

export const GET = route<{ id: string }>({ permission: "consultation:read" }, async ({ auth, params, audit }) => {
  const c = await getConsultation(auth, params.id);
  await audit("consultation.view", "consultation", params.id);
  return ok(c);
});

const patch = updateConsultationSchema.extend({ complete: z.boolean().optional() });

export const PATCH = route<{ id: string }>({ permission: "consultation:write" }, async ({ req, auth, params, audit }) => {
  const { complete, ...data } = await parseBody(req, patch);
  const res = Object.keys(data).length ? await updateConsultation(auth, params.id, data) : await getConsultation(auth, params.id);
  if (complete) {
    await completeConsultation(auth, params.id);
    await audit("consultation.complete", "consultation", params.id);
  }
  await audit("consultation.update", "consultation", params.id, { fields: Object.keys(data) });
  return ok(res);
});
