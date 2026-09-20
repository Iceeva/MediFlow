import { route } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { changePasswordSchema } from "@/features/auth/schemas";
import { changePassword } from "@/services/auth.service";
import { revokeOtherSessions, rotateSession } from "@/lib/session";

export const POST = route({ rateLimit: { limit: 5, windowSec: 600 } }, async ({ req, auth, ip, userAgent, audit }) => {
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
  await changePassword(auth.userId, currentPassword, newPassword);
  await revokeOtherSessions(auth.userId, auth.sessionId);
  await rotateSession(auth, { ip, userAgent });
  await audit("auth.password.change", "user", auth.userId);
  return ok({ changed: true });
});
