-- OPTIONAL hardening, apply once AFTER the initial Prisma migration.
-- The application already prevents double booking inside a SERIALIZABLE transaction.
-- This exclusion constraint makes PostgreSQL itself reject overlapping appointments
-- for the same doctor, even if some other code path forgets the check.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
  ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    "doctorId" WITH =,
    tstzrange("startsAt", "endsAt") WITH &&
  )
  WHERE ("status" NOT IN ('CANCELLED', 'NO_SHOW'));
