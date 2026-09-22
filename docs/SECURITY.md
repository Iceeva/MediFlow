# Security notes

MediFlow handles sensitive health data. This document explains what the code does, what it deliberately does not do, and what you must still do yourself.

> No part of this repository makes you compliant with HIPAA, GDPR / health data hosting rules or any national regulation. Compliance depends on country, hosting, subcontractors (DPA / BAA), staff procedures and audits.

## Threat model summary

| Threat | Mitigation in the code | Where |
|---|---|---|
| A user reads another clinic's data | `tenantId` taken from the session, in every `where`, 404 for foreign ids | `lib/tenant.ts`, `services/scope.ts` |
| Client forges a `tenantId` | Never read from body, query or headers (single documented exception for SUPER_ADMIN bootstrapping an admin) | `app/api/v1/users/route.ts` |
| Privilege escalation inside a clinic | RBAC matrix, row scopes by role, explicit grants for nurses, admin cannot read consultations | `lib/permissions.ts`, `services/scope.ts` |
| Session theft | HTTP-only, Secure, SameSite cookie, hashed token in DB, short sliding expiry, revocation, rotation on password change | `lib/session.ts` |
| CSRF | SameSite=Lax and Origin / Sec-Fetch-Site verification on mutations | `lib/api.ts` |
| Credential stuffing, brute force | bcrypt 12 rounds, rate limit 10 per 5 min per IP, equalized timing, uniform error | `services/auth.service.ts`, `lib/rate-limit.ts` |
| Account enumeration | Forgot password always answers 200, login error is generic | auth routes |
| SQL injection | Prisma parameterization, tagged-template raw queries only, sort columns whitelisted | `lib/http.ts` |
| XSS | React escaping, no `dangerouslySetInnerHTML`, CSP, escaped email HTML | `next.config.ts` |
| Malicious upload | Magic-byte verification, extension and declared type must match, 4 MB cap, sanitized names, server-chosen storage key | `lib/storage/validate.ts` |
| Direct access to stored files | Private bucket (S3 / R2) or AES-256-GCM encrypted blobs, never served directly, short signed links bound to document and user, access re-checked on use | `lib/storage/*` |
| Payment tampering or fraud | Amount computed server-side, webhook signature, event idempotency, amount verification, idempotency keys, row lock | `services/payment.service.ts` |
| Replay of webhooks | `WebhookEvent` unique constraint | same |
| Log leakage | JSON logger redacts password, token, email, phone, medical field names; unhandled errors log only the message | `lib/logger.ts` |
| Tampering with the audit trail | No update or delete route exists; audit write failures are logged | `lib/audit.ts`, `app/api/v1/audit` |
| Cron abuse | Route closed unless `Authorization: Bearer $CRON_SECRET` matches (constant-time compare) | `notifications/cron/route.ts` |

## Authorization checklist for new endpoints

1. Wrap it in `route({ permission })` (or `publicRoute` for a documented reason).
2. Take the tenant from `auth` (`requireTenantId`), never from input.
3. Build `where` from `services/scope.ts`, or add a new fragment there (fail closed).
4. Validate with Zod, whitelist sort columns, cap `pageSize`.
5. Call `audit(...)` for reads of clinical data and for every write.
6. Add a case to `tests/integration/isolation.test.ts`.

## Known gaps

- No 2FA / TOTP yet.
- No antivirus scanning on uploads (extension point in `lib/storage/validate.ts`).
- Rate limiting is per IP; behind shared NAT it can be too strict, and it is not a DDoS defense (use Vercel Firewall / WAF for that).
- Vercel Blob objects are encrypted because blob URLs are public but unguessable. Prefer a private S3 / R2 bucket for stricter environments.
- The audit log is append-only at the application level. A database administrator can still alter it: ship it to external immutable storage if your regulation requires tamper evidence.
- Application-level tenant filtering is not backed by PostgreSQL Row Level Security yet.
- No data retention or erasure workflow (GDPR right to erasure needs a documented process because medical records have legal retention duties).

## Operational recommendations

- Generate `AUTH_SECRET` with `openssl rand -base64 48`, store it only in Vercel environment variables, and plan for rotation (rotation invalidates sessions and makes existing blobs unreadable: re-encrypt first).
- Enable database encryption at rest, point-in-time recovery and backups with your provider; test restores.
- Use a separate database and secrets per environment. Never run the demo seed in production.
- Restrict who can access the Vercel project, the database and the storage bucket; enable MFA on those accounts.
- Review `AuditLog` entries with `result = DENIED` regularly.
