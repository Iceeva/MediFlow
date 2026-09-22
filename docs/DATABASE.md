# Database reference

PostgreSQL, accessed only through Prisma (`prisma/schema.prisma`). Primary keys are UUIDs (`@db.Uuid`). Money uses `Decimal(12,2)`. Dates are `timestamptz` except `Patient.dateOfBirth` (`date`).

## Conventions

- Every business table has a `tenantId` (the clinic). Almost every composite index starts with `tenantId`, because every query filters on it.
- Soft deletion: `Patient.deletedAt / archivedAt`, `Doctor.deletedAt`, `StaffProfile.deletedAt`, `MedicalDocument.deletedAt`, `Tenant.deletedAt`. Medical rows are never physically removed by the API.
- `onDelete: Cascade` goes from `Tenant` downwards (so removing a clinic removes its data) and from a `User` to their sessions, tokens, notifications and memberships. `AuditLog` uses `SetNull` so logs survive the deletion of a user or a tenant.

## Models

| Model | Purpose | Notable constraints and indexes |
|---|---|---|
| `Tenant` | A healthcare facility | `slug` unique, `timezone` (IANA, default UTC) |
| `User` | A person who can sign in | `email` unique, `isSuperAdmin`, `disabledAt` |
| `Membership` | Role of a user inside a tenant | unique `(userId, tenantId)`, index `(tenantId, role)` |
| `Session` | Server-side session | `tokenHash` unique (HMAC of the cookie value), index `(userId, revokedAt)`, `expiresAt` |
| `VerificationToken` | Email verification and password reset | `tokenHash` unique, `purpose`, `usedAt` |
| `RateLimit` | Fixed-window counters (no Redis) | primary key is the limiter key, index `resetAt` |
| `SequenceCounter` | Per-tenant numbering | primary key `(tenantId, name)` |
| `Patient` | Medical file | indexes `(tenantId, lastName, firstName)`, `(tenantId, email)`, `(tenantId, createdAt)`; optional unique `userId` links a patient account |
| `PatientAccess` | Explicit access grant for a doctor or nurse | unique `(patientId, userId)` |
| `Doctor` | Doctor profile | unique `userId`, unique `(tenantId, licenseNumber)` |
| `DoctorAvailability` | Weekly slots (`dayOfWeek`, `HH:mm`) | index `(doctorId, dayOfWeek)` |
| `StaffProfile` | Nurse, receptionist, accountant profile | unique `userId` |
| `Appointment` | A booking | indexes `(tenantId, startsAt)`, `(tenantId, doctorId, startsAt, endsAt)`, `(tenantId, patientId, startsAt)`, `(tenantId, status)` |
| `Consultation` | Clinical record of one appointment | unique `appointmentId` (one consultation per appointment) |
| `Vital` | Measurements | index `(tenantId, patientId, recordedAt)` |
| `Medication` | Clinic formulary | indexes on `name`, `genericName`, `status` |
| `Prescription` / `PrescriptionItem` | Prescription and its lines | unique `(tenantId, number)` |
| `MedicalDocument` | File metadata | `storageKey` unique, `accessPolicy` (`STAFF_ONLY` or `PATIENT_VISIBLE`), never exposed by the API |
| `Invoice` / `InvoiceItem` | Billing | unique `(tenantId, number)`, index `(tenantId, status, dueDate)` |
| `Payment` | Money movement | `idempotencyKey` unique (prefixed with the tenant id), index `(provider, providerReference)` |
| `WebhookEvent` | Processed provider events | unique `(provider, eventId)` |
| `Notification` | In-app notifications | index `(tenantId, userId, read, createdAt)` |
| `AuditLog` | Append-only audit trail | indexes `(tenantId, createdAt)`, `(tenantId, userId, createdAt)`, `(tenantId, resource, resourceId)` |

## Enums

`Role`, `Gender`, `TenantStatus`, `DoctorStatus`, `MedicationStatus`, `AppointmentStatus`, `DocumentType`, `DocumentAccess`, `InvoiceStatus`, `PaymentStatus`, `PaymentMethod`, `NotificationType`, `TokenPurpose`, `AuditResult`.

## Concurrency and integrity

- **Double booking**: `createAppointment` and rescheduling run in a SERIALIZABLE transaction and retry on `P2034`. As defense in depth you can add the PostgreSQL exclusion constraint in `prisma/sql/appointment_overlap.sql` (needs the `btree_gist` extension).
- **Invoice settlement**: payments are applied under `SELECT ... FOR UPDATE` on the invoice row, and `amountPaid` is recomputed from the sum of `SUCCEEDED` payments rather than incremented.
- **Numbering**: `SequenceCounter` is incremented with a single atomic upsert, so concurrent requests never share a number.
- **Webhooks**: the `WebhookEvent` insert and the payment update are one transaction.

## Migrations

```bash
npx prisma migrate dev --name init     # first time, creates and applies prisma/migrations/<date>_init
npx prisma migrate dev --name <change> # later schema changes
npx prisma migrate deploy              # CI and production
```

`DIRECT_URL` (non pooled) is used by Prisma Migrate, `DATABASE_URL` (pooled) at runtime.

## Data retention

The audit log and soft-deleted medical rows are kept indefinitely by the application. Decide a retention policy that matches your legal obligations and implement purge jobs deliberately: do not purge from the API.
