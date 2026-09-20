import { z } from "zod";
import { route } from "@/lib/api";
import { created, paged, paginationSchema, parseBody, parseQuery } from "@/lib/http";
import { createPatientSchema } from "@/features/patients/schemas";
import { createPatient, listPatients } from "@/services/patient.service";

const querySchema = paginationSchema.extend({
  archived: z.enum(["true", "false"]).optional(),
  gender: z.enum(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"]).optional(),
});

export const GET = route({ permission: "patient:read" }, async ({ auth, query, audit }) => {
  const p = parseQuery(query, querySchema);
  const { items, total } = await listPatients(auth, p, { archived: p.archived === "true", gender: p.gender });
  await audit("patient.list", "patient", null, { count: items.length });
  return paged(items, total, p);
});

export const POST = route({ permission: "patient:write" }, async ({ req, auth, audit }) => {
  const input = await parseBody(req, createPatientSchema);
  const patient = await createPatient(auth, input);
  await audit("patient.create", "patient", patient.id);
  return created(patient);
});
