import { z } from "zod";
import { route } from "@/lib/api";
import { created, paged, paginationSchema, parseBody, parseQuery } from "@/lib/http";
import { createPrescriptionSchema } from "@/features/prescriptions/schemas";
import { createPrescription, listPrescriptions } from "@/services/prescription.service";

const querySchema = paginationSchema.extend({ patientId: z.string().uuid().optional() });

export const GET = route({ permission: "prescription:read" }, async ({ auth, query, audit }) => {
  const p = parseQuery(query, querySchema);
  const { items, total } = await listPrescriptions(auth, p, p.patientId);
  await audit("prescription.list", "prescription", null, { count: items.length });
  return paged(items, total, p);
});

export const POST = route({ permission: "prescription:write" }, async ({ req, auth, audit }) => {
  const input = await parseBody(req, createPrescriptionSchema);
  const rx = await createPrescription(auth, input);
  await audit("prescription.create", "prescription", rx.id);
  return created(rx);
});
