import { route } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { updateUserSchema } from "@/features/users/schemas";
import { updateTenantUser } from "@/services/user.service";
import { requireTenantId } from "@/lib/tenant";

export const PATCH = route<{ id: string }>({ permission: "user:manage" }, async ({ req, auth, params, audit }) => {
  const patch = await parseBody(req, updateUserSchema);
  const res = await updateTenantUser(requireTenantId(auth), auth.userId, params.id, patch);
  await audit("user.update", "user", params.id, { fields: Object.keys(patch) });
  return ok(res);
});
