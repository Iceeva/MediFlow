import { publicRoute } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { loginSchema } from "@/features/auth/schemas";
import { login } from "@/services/auth.service";
import { setSessionCookie } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { ApiError } from "@/lib/errors";

export const POST = publicRoute({ rateLimit: { limit: 10, windowSec: 300 } }, async ({ req, ip, userAgent }) => {
  const input = await parseBody(req, loginSchema);
  try {
    const { session, user, emailVerified } = await login(input, { ip, userAgent });
    await setSessionCookie(session.token, session.expiresAt);
    await writeAudit({ tenantId: user.tenantId, userId: user.id, action: "auth.login", resource: "session", ip, userAgent });
    return ok({ user, emailVerified });
  } catch (e) {
    if (e instanceof ApiError) {
      await writeAudit({ action: "auth.login", resource: "session", result: "FAILURE", ip, userAgent });
    }
    throw e;
  }
});
