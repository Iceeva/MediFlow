import { route } from "@/lib/api";
import { ok } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { revokeSession } from "@/lib/session";

export const DELETE = route<{ id: string }>({}, async ({ auth, params, audit }) => {
  const res = await revokeSession(auth.userId, params.id);
  if (res.count === 0) throw notFound("Session not found");
  await audit("auth.session.revoke", "session", params.id);
  return ok({ revoked: true });
});
