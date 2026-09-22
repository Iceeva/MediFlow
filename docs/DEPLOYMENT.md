# Deployment guide (Vercel)

Target: GitHub -> Vercel (Next.js frontend and API Route Handlers) -> managed PostgreSQL + object storage. No Redis, queue or permanent server.

## 1. Database

Create a managed PostgreSQL database (Neon, Supabase, Vercel Postgres or another provider with a serverless pooler).

You need two URLs:

```text
DATABASE_URL = pooled connection (pooler host), used at runtime
               add  ?pgbouncer=true&connection_limit=1  if your pooler is PgBouncer in transaction mode
DIRECT_URL   = direct connection (no pooler), used by prisma migrate
```

Why: every serverless invocation may open a new connection. Without a pooler you will exhaust PostgreSQL connections under load. The Prisma client is reused across warm invocations (`lib/prisma.ts`) but is never assumed to stay connected.

## 2. Initial migration

```bash
npx prisma migrate dev --name init
git add prisma/migrations && git commit -m "feat(db): add initial migration" && git push
```

The Vercel build runs `prisma migrate deploy`. Without the migration folder in Git, no table is created.

Optional hardening (once): run `prisma/sql/appointment_overlap.sql` against the database.

## 3. Object storage

Option A, Vercel Blob: Project > Storage > Create Blob store, copy `BLOB_READ_WRITE_TOKEN`, set `STORAGE_PROVIDER=blob`.

Option B, S3 or Cloudflare R2: create a **private** bucket (block public access), create an access key limited to that bucket, set:

```text
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com   (omit for AWS S3)
S3_REGION=auto                                              (or the AWS region)
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

## 4. Vercel project

1. Import the GitHub repository. Framework preset: Next.js. Node 20 or 22.
2. Add every variable from `.env.example` (Production, and Preview with separate resources).
3. The build command comes from `vercel.json`: `prisma generate && prisma migrate deploy && next build`.
4. Deploy. Check `https://<domain>/api/health` returns `{"status":"ok","database":"up"}`.

## 5. Payments (Stripe)

1. Set `PAYMENT_SECRET_KEY` (secret key).
2. Developers > Webhooks > add endpoint `https://<domain>/api/v1/payments/webhook?provider=stripe` with the events `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`.
3. Copy the signing secret into `PAYMENT_WEBHOOK_SECRET`.

Local testing: `stripe listen --forward-to localhost:3000/api/v1/payments/webhook?provider=stripe`.

Zero-decimal currencies (XOF, XAF, JPY...) are handled when converting amounts for the provider (`lib/billing.ts`). Other providers (Mobile Money, bank): not implemented, see `lib/payments/index.ts`.

## 6. Email

Create a Resend API key and a verified sending domain, set `EMAIL_API_KEY` and `EMAIL_FROM`. Without a key the app works but sends nothing (it logs a warning).

## 7. Cron

`vercel.json` schedules `GET /api/v1/notifications/cron` daily at 07:00 UTC. Set `CRON_SECRET` (Vercel automatically sends it as `Authorization: Bearer`). Manual run:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/v1/notifications/cron
```

The job is idempotent: one reminder per appointment, safe to re-run.

## 8. First accounts

- Self-service: `/register`, tab "I run a clinic" creates the clinic and its admin.
- Platform operator: create a user, then set `isSuperAdmin = true` in the database. Sign in without a clinic address, then use Settings > Clinics.

## 9. GitHub Actions (optional)

`lint.yml` and `test.yml` run on every push and pull request. `deploy.yml` deploys with the Vercel CLI after both pass and needs the secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. If you use Vercel's native Git integration, delete `deploy.yml` to avoid deploying twice.

## 10. Monitoring

- `/api/health` for uptime checks (503 when the database is unreachable).
- Vercel logs: structured JSON, sensitive fields redacted. Search for `unhandled_error`, `webhook_rejected`, `email_send_failed`, `audit_write_failed`.
- Add an external error tracker (for example Sentry) if you need alerting.

## 11. Rollback

Vercel: promote a previous deployment. Database migrations are forward only: write a new migration to undo a schema change, and take a backup before destructive ones.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Tables do not exist after deploy | `prisma/migrations` was not committed |
| `Too many connections` | `DATABASE_URL` is not the pooled URL |
| All sessions suddenly invalid | `AUTH_SECRET` changed |
| Documents fail to open after a secret change | blobs were encrypted with the previous `AUTH_SECRET` |
| Payment stays `PENDING` | webhook not configured, wrong `PAYMENT_WEBHOOK_SECRET`, or the endpoint URL is missing `?provider=stripe` |
| Reminders never arrive | `CRON_SECRET` missing, or `EMAIL_API_KEY` not set |
| Upload rejected with 413 | file larger than the Vercel request limit (4 MB here) |
