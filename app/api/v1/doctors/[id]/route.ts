import { route } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { updateDoctorSchema } from "@/features/doctors/schemas";
import { getDoctor, updateDoctor } from "@/services/doctor.service";

export const GET = route<{ id: string }>({ permission: "doctor:read" }, async ({ auth, params }) => ok(await getDoctor(auth, params.id)));

export const PATCH = route<{ id: string }>({ permission: "doctor:manage" }, async ({ req, auth, params, audit }) => {
  const data = await parseBody(req, updateDoctorSchema);
  const res = await updateDoctor(auth, params.id, data);
  await audit("doctor.update", "doctor", params.id, { fields: Object.keys(data) });
  return ok(res);
});
