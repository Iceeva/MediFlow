import { route } from "@/lib/api";
import { ok } from "@/lib/http";
import { listSessions, revokeOtherSessions } from "@/lib/session";

export const GET = route({}, async ({ auth }) => {
  const sessions = await listSessions(auth.userId);
  return ok(sessions.map((s) => ({ ...s, current: s.id === auth.sessionId })));
});

// Revoke every session except the current one ("sign out everywhere else").
export const DELETE = route({}, async ({ auth, audit }) => {
  const res = await revokeOtherSessions(auth.userId, auth.sessionId);
  await audit("auth.sessions.revoke_others", "session", null, { count: res.count });
  return ok({ revoked: res.count });
});
