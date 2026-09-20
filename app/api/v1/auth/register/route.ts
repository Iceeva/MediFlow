import { publicRoute } from "@/lib/api";
import { created, parseBody } from "@/lib/http";
import { registerSchema } from "@/features/auth/schemas";
import { register } from "@/services/auth.service";
import { setSessionCookie } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export const POST = publicRoute({ rateLimit: { limit: 10, windowSec: 3600 } }, async ({ req, ip, userAgent }) => {
  const input = await parseBody(req, registerSchema);
  const { session, user } = await register(input, { ip, userAgent });
  await setSessionCookie(session.token, session.expiresAt);
  await writeAudit({ userId: user.id, action: "auth.register", resource: "user", resourceId: user.id, ip, userAgent });
  return created({ user });
});
