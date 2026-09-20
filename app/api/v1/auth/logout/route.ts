import { route } from "@/lib/api";
import { ok } from "@/lib/http";
import { clearSessionCookie, revokeSession } from "@/lib/session";

export const POST = route({}, async ({ auth, audit }) => {
  await revokeSession(auth.userId, auth.sessionId);
  await clearSessionCookie();
  await audit("auth.logout", "session", auth.sessionId);
  return ok({ loggedOut: true });
});
