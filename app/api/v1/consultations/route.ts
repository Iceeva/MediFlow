import { z } from "zod";
import { route } from "@/lib/api";
import { created, paged, paginationSchema, parseBody, parseQuery } from "@/lib/http";
import { createConsultationSchema } from "@/features/consultations/schemas";
import { createConsultation, listConsultations } from "@/services/consultation.service";

const querySchema = paginationSchema.extend({ patientId: z.string().uuid().optional() });

export const GET = route({ permission: "consultation:read" }, async ({ auth, query, audit }) => {
  const p = parseQuery(query, querySchema);
  const { items, total } = await listConsultations(auth, p, p.patientId);
  await audit("consultation.list", "consultation", null, { patientId: p.patientId ?? null, count: items.length });
  return paged(items, total, p);
});

export const POST = route({ permission: "consultation:write" }, async ({ req, auth, audit }) => {
  const input = await parseBody(req, createConsultationSchema);
  const c = await createConsultation(auth, input);
  await audit("consultation.create", "consultation", c.id);
  return created(c);
});
