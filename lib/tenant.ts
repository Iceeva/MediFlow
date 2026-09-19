import type { AuthContext } from "./session";
import { forbidden } from "./errors";

/**
 * The tenant ALWAYS comes from the authenticated session, never from the request body,
 * query string or headers. Super admins have no tenant and cannot call tenant-scoped data routes.
 */
export function requireTenantId(auth: Pick<AuthContext, "tenantId">): string {
  if (!auth.tenantId) throw forbidden("This action requires a tenant context");
  return auth.tenantId;
}

export const tenantWhere = (auth: Pick<AuthContext, "tenantId">) => ({ tenantId: requireTenantId(auth) });
