# MediFlow API reference (v1)

Base path: `/api/v1`. All bodies are JSON unless stated. Authentication is the HTTP-only `mf_session` cookie (see README, section 7). Mutating requests must come from the same origin.

## Conventions

**Success**

```json
{ "data": { }, "meta": { "page": 1, "pageSize": 20, "total": 134, "totalPages": 7 } }
```

`meta` is present on paginated lists. Notifications add `meta.unread`.

**Error**

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": { "fieldErrors": { "email": ["Invalid email"] } } } }
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed request or business rule (for example "overpayment") |
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | Role lacks the permission (the denial is audited) |
| 404 | `NOT_FOUND` | Missing **or in another tenant or outside your role scope** (never reveals existence) |
| 409 | `CONFLICT` | Duplicate value, double booking, concurrent update |
| 422 | `VALIDATION_ERROR` | Zod validation failed (`details` is the flattened Zod error) |
| 429 | `RATE_LIMITED` | `Retry-After` header and `details.retryAfterSec` |
| 500 | `INTERNAL_ERROR` | Generic message, details only in server logs |
| 501 | `NOT_IMPLEMENTED` | Unsupported payment provider |

**Pagination**: `page` (default 1), `pageSize` (default 20, max 100, appointments up to 500), `q` (search text), `sortBy` (whitelisted per resource), `order` (`asc` or `desc`).

**Tenant**: never sent by the client. It is read from the session.

Roles below use these abbreviations: **SA** SUPER_ADMIN, **CA** CLINIC_ADMIN, **DOC** DOCTOR, **NUR** NURSE, **REC** RECEPTIONIST, **ACC** ACCOUNTANT, **PAT** PATIENT. "any" means any signed-in user.

---

## Auth

| Method and path | Access | Notes |
|---|---|---|
| `POST /auth/register` | public, 10/h per IP | Body is `{ "type": "clinic", email, password, firstName, lastName, clinicName, clinicSlug }` or `{ "type": "patient", email, password, firstName, lastName, clinicSlug, dateOfBirth }`. Signs the user in. Sends a verification email |
| `POST /auth/login` | public, 10 per 5 min per IP | `{ email, password, clinicSlug? }`. Same error for unknown email and wrong password |
| `POST /auth/logout` | any | Revokes the current session |
| `GET /auth/me` | any | `user, tenant, userId, role, doctorId, patientId, permissions[]` |
| `GET /auth/sessions` | any | Active sessions, `current: true` on this one |
| `DELETE /auth/sessions` | any | Signs out every other device |
| `DELETE /auth/sessions/[id]` | any | Revokes one of your sessions |
| `POST /auth/password` | any, 5 per 10 min | `{ currentPassword, newPassword }`. Revokes other sessions, rotates the current token |
| `POST /auth/forgot-password` | public | `{ email }`. Always 200 |
| `POST /auth/reset-password` | public | `{ token, password }`. Single use token, revokes all sessions |
| `POST /auth/verify-email` | public | `{ token }` |

Password policy: 10 to 128 characters, at least one lower case letter, one upper case letter and one digit.

## Tenants and users

| Method and path | Access | Notes |
|---|---|---|
| `GET /tenants` | any | SA sees all clinics, others only their own |
| `POST /tenants` | SA | `{ name, slug, timezone?, email?, phone?, address?, admin: { email, firstName, lastName } }`. Invites the admin by email |
| `PATCH /tenants/[id]` | SA, CA (own clinic) | `{ name?, email?, phone?, address?, timezone?, status? }`. Only SA can change `status` (`ACTIVE`, `SUSPENDED`) |
| `GET /users` | CA | Members of your clinic. Filters `role`, `q` |
| `POST /users` | CA, SA | Invite staff: `{ email, firstName, lastName, role, specialization?, licenseNumber?, consultationFee?, jobTitle? }`. Doctors need specialization and license number. SA may only create `CLINIC_ADMIN` and must pass `tenantId` (the only place a tenantId is accepted) |
| `PATCH /users/[id]` | CA | `{ role?, disabled?, firstName?, lastName?, phone? }`. You cannot disable yourself or change your own role. Disabling revokes sessions |

## Patients

| Method and path | Access | Notes |
|---|---|---|
| `GET /patients` | CA, DOC, NUR, REC, PAT | Filters `q`, `archived=true`, `gender`; sort `lastName, firstName, createdAt, dateOfBirth`. Scope: CA/REC whole clinic, DOC patients with an appointment or a grant, NUR patients with a grant, PAT only themselves. REC receives demographics only |
| `POST /patients` | CA, REC | See schema below. Clinical fields are ignored for REC |
| `GET /patients/[id]` | same scope | Audited (`patient.view`) |
| `PATCH /patients/[id]` | CA, REC (write), CA (archive) | Any subset of the create fields, plus `archived: boolean` |
| `DELETE /patients/[id]` | CA | Soft delete |
| `POST /patients/[id]/access` | CA | `{ userId }` grants a doctor or nurse access |
| `DELETE /patients/[id]/access` | CA | `{ userId }` revokes it |
| `GET /patients/[id]/export` | CA, DOC, NUR, PAT, 10/h | JSON attachment, audited (`patient.export`) |

Patient body: `firstName, lastName, dateOfBirth, gender (FEMALE|MALE|OTHER|UNDISCLOSED), phone, email, address, emergencyContactName, emergencyContactPhone, bloodType (A+ ... O-), allergies[], medicalHistory, currentMedications, insuranceProvider, insuranceNumber`.

## Doctors

| Method and path | Access | Notes |
|---|---|---|
| `GET /doctors` | CA, DOC, NUR, REC, PAT | Filters `q`, `specialization`. PAT does not receive license numbers |
| `GET /doctors/[id]` | same | Includes availability and stats |
| `PATCH /doctors/[id]` | CA | `{ specialization?, licenseNumber?, phone?, consultationFee?, status? }` |
| `PUT /doctors/[id]/availability` | CA, or the doctor for themselves | `{ slots: [{ dayOfWeek 0-6, startTime "HH:mm", endTime "HH:mm" }] }` replaces the whole agenda |

Doctors are created with `POST /users` (role `DOCTOR`).

## Appointments

| Method and path | Access | Notes |
|---|---|---|
| `GET /appointments` | CA, DOC, NUR, REC, PAT | Filters `from`, `to`, `doctorId`, `patientId`, `status`. DOC sees their own, PAT their own |
| `POST /appointments` | CA, DOC, REC, PAT | `{ patientId?, doctorId, startsAt, endsAt, reason?, notes? }`. PAT always books for themselves (status `PENDING`), staff bookings are `CONFIRMED`. Returns 409 on overlap for the doctor or the patient, 400 outside the doctor's availability |
| `GET /appointments/[id]` | same scope | |
| `PATCH /appointments/[id]` | CA, DOC, REC, PAT (cancel only) | `{ status?, startsAt?, endsAt?, reason?, notes? }` |

Allowed status transitions:

```text
PENDING     -> CONFIRMED, CANCELLED
CONFIRMED   -> CHECKED_IN, CANCELLED, NO_SHOW
CHECKED_IN  -> IN_PROGRESS, CANCELLED, NO_SHOW
IN_PROGRESS -> COMPLETED
COMPLETED, CANCELLED, NO_SHOW -> (final)
```

Double booking is prevented inside a SERIALIZABLE transaction (with up to 3 retries on serialization failure).

## Consultations and vitals

| Method and path | Access | Notes |
|---|---|---|
| `GET /consultations` | DOC, NUR | Filter `patientId`. Scope follows patient access. Audited |
| `POST /consultations` | DOC | `{ appointmentId, symptoms?, diagnosis?, observations?, treatment?, notes?, followUpAt?, vitals? }`. Only the appointment's doctor. Moves the appointment to `IN_PROGRESS` |
| `GET /consultations/[id]` | DOC, NUR | Audited |
| `PATCH /consultations/[id]` | DOC (author) | Fields above plus `complete: true` to mark the appointment `COMPLETED` |
| `POST /vitals` | DOC, NUR | `{ patientId, consultationId?, systolic?, diastolic?, heartRate?, temperatureC?, weightKg?, heightCm?, oxygenSaturation? }` with at least one measurement |

## Prescriptions and medications

| Method and path | Access | Notes |
|---|---|---|
| `GET /prescriptions` | DOC, NUR, PAT | Filter `patientId` |
| `POST /prescriptions` | DOC | `{ patientId, consultationId?, notes?, items: [{ medicationId?, medicationName, dosage, frequency, duration, route?, instructions? }] }`. Generates a unique number `RX-YYYY-00001` and notifies the patient |
| `GET /prescriptions/[id]` | DOC, NUR, PAT | |
| `GET /prescriptions/[id]/pdf` | same | `application/pdf` attachment |
| `GET /medications` | CA, DOC, NUR | Filters `q`, `status`, `dosageForm` |
| `POST /medications` | CA | `{ name, genericName?, dosageForm?, strength?, manufacturer?, status? }` |
| `PATCH /medications/[id]` | CA | |
| `DELETE /medications/[id]` | CA | Sets `DISCONTINUED` (history is preserved) |

## Documents

| Method and path | Access | Notes |
|---|---|---|
| `GET /documents` | DOC, NUR, PAT | Filters `patientId`, `type`, `q`. PAT only sees `PATIENT_VISIBLE` documents of their own record. Storage keys are never returned |
| `POST /documents` | DOC, 30 per 10 min | `multipart/form-data`: `file`, `patientId`, `type?`, `accessPolicy?` (`STAFF_ONLY` or `PATIENT_VISIBLE`). PDF, PNG, JPEG, WebP up to 4 MB, content verified by magic bytes |
| `GET /documents/[id]` | same scope | Metadata |
| `DELETE /documents/[id]` | uploader only | Removes the object, soft-deletes the row |
| `POST /documents/[id]/url` | same scope | Returns `{ url, expiresAt }`, valid 120 seconds, bound to the document and the user |
| `GET /documents/[id]/download?token=` | same scope + valid token | Streams the file. Audited (`document.download`) |

## Invoices and payments

| Method and path | Access | Notes |
|---|---|---|
| `GET /invoices` | CA, ACC, PAT | Filters `status`, `patientId`, `q`. PAT sees only their own |
| `POST /invoices` | CA, ACC | `{ patientId, items: [{ description, quantity, unitPrice }], discount?, taxRatePercent?, dueDate?, notes?, currency?, issue? }`. Totals are computed by the server. `issue: true` creates a `PENDING` invoice, otherwise `DRAFT` |
| `GET /invoices/[id]` | same scope | PAT cannot see drafts or cancelled invoices |
| `PATCH /invoices/[id]` | CA, ACC | Lines can only change while `DRAFT`. `status: "PENDING"` issues a draft, `"CANCELLED"` cancels an unpaid invoice |
| `GET /invoices/[id]/pdf` | same scope | |
| `GET /payments` | CA, ACC, PAT | Filters `invoiceId`, `status` |
| `POST /payments` | see below | 30 per 10 min |
| `POST /payments/webhook?provider=stripe` | public, signature | Provider webhook |

`POST /payments` body (an idempotency key is **required**, either in the body or in the `Idempotency-Key` header):

```json
{ "mode": "manual", "invoiceId": "uuid", "amount": 5000, "method": "CASH", "reference": "receipt 42", "idempotencyKey": "8f1c2c2e-..." }
```

```json
{ "mode": "online", "invoiceId": "uuid", "provider": "stripe", "idempotencyKey": "8f1c2c2e-..." }
```

- `manual` needs `payment:write` (CA, ACC). It is confirmed immediately. Amount cannot exceed the balance.
- `online` (CA, ACC, PAT). The **amount is the invoice balance computed by the server**. The payment stays `PENDING` and the response contains `redirectUrl`. It becomes `SUCCEEDED` **only when the verified webhook arrives**.
- Replaying the same key returns the original payment with `replayed: true` and creates nothing.

Webhook: raw body signature is verified, the event id is stored (`WebhookEvent`) in the same transaction as the state change so retries are no-ops, and an event whose amount differs from the charge marks the payment `FAILED`.

## Notifications, analytics, audit, search, health

| Method and path | Access | Notes |
|---|---|---|
| `GET /notifications` | any clinic user | Filter `unread=true`. `meta.unread` is the unread count |
| `POST /notifications` | any clinic user | Marks all as read |
| `PATCH /notifications/[id]` | owner | `{ read: boolean }` |
| `GET /notifications/cron` | `Authorization: Bearer $CRON_SECRET` | Daily job: appointment reminders (24 h, once per appointment), overdue invoices, cleanup of expired sessions and tokens |
| `GET /analytics` | any | Content depends on the role: platform totals (SA), clinic dashboard with series (CA), financial figures (ACC), personal agenda (DOC), personal summary (PAT) |
| `GET /audit` | CA, SA | Filters `userId, resource, action, result, from, to`. Read only |
| `GET /search?q=` | CA, DOC, NUR, REC, ACC | 2 to 80 characters, 120 per minute. Results respect the same scopes as the list endpoints |
| `GET /api/health` | public | `{ status, database, latencyMs }`, 503 when the database is down |
