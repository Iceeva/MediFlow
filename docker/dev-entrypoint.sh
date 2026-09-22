#!/bin/sh
set -e

# Wait for PostgreSQL (compose healthcheck already gates this, kept for plain `docker run`)
echo "Applying database schema..."
if ls prisma/migrations/*/migration.sql >/dev/null 2>&1; then
  npx prisma migrate deploy
else
  # First run on a fresh clone: create the initial migration (it appears in ./prisma/migrations, commit it)
  npx prisma migrate dev --name init --skip-generate --skip-seed
fi

if [ "${SEED_DEMO_DATA:-true}" = "true" ]; then
  echo "Seeding fictional demo data..."
  npx prisma db seed || echo "Seed skipped (already applied?)"
fi

exec npm run dev -- --hostname 0.0.0.0
