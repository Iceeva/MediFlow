import { z } from "zod";
import { route } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { updatePatientSchema } from "@/features/patients/schemas";
import { archivePatient, deletePatient, getPatient, updatePatient } from "@/services/patient.service";

export const GET = route<{ id: string }>({ permission: "patient:read" }, async ({ auth, params, audit }) => {
  const patient = await getPatient(auth, params.id);
  await audit("patient.view", "patient", params.id);
  return ok(patient);
});

const patchSchema = updatePatientSchema.extend({ archived: z.boolean().optional() });

export const PATCH = route<{ id: string }>({ permission: ["patient:write", "patient:archive"] }, async ({ req, auth, params, audit }) => {
  const { archived, ...data } = await parseBody(req, patchSchema);
  if (archived !== undefined) {
    const res = await archivePatient(auth, params.id, archived);
    await audit(archived ? "patient.archive" : "patient.unarchive", "patient", params.id);
    if (Object.keys(data).length === 0) return ok(res);
  }
  const res = await updatePatient(auth, params.id, data);
  await audit("patient.update", "patient", params.id, { fields: Object.keys(data) });
  return ok(res);
});

export const DELETE = route<{ id: string }>({ permission: "patient:archive" }, async ({ auth, params, audit }) => {
  const res = await deletePatient(auth, params.id);
  await audit("patient.delete", "patient", params.id);
  return ok(res);
});
