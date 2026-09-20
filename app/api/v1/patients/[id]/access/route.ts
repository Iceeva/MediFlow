import { route } from "@/lib/api";
import { created, ok, parseBody } from "@/lib/http";
import { grantAccessSchema } from "@/features/patients/schemas";
import { grantAccess, revokeAccess } from "@/services/patient.service";

export const POST = route<{ id: string }>({ permission: "patient:grant" }, async ({ req, auth, params, audit }) => {
  const { userId } = await parseBody(req, grantAccessSchema);
  const res = await grantAccess(auth, params.id, userId);
  await audit("patient.access.grant", "patient", params.id, { userId });
  return created(res);
});

export const DELETE = route<{ id: string }>({ permission: "patient:grant" }, async ({ req, auth, params, audit }) => {
  const { userId } = await parseBody(req, grantAccessSchema);
  await revokeAccess(auth, params.id, userId);
  await audit("patient.access.revoke", "patient", params.id, { userId });
  return ok({ revoked: true });
});
