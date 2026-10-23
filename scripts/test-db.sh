#!/usr/bin/env bash
# Baza testlari: bo'sh Postgres bazasiga Supabase stub, migratsiyalar, seed va testlarni qo'llaydi.
# Foydalanish: TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/dk_test npm run test:db
# DIQQAT: ko'rsatilgan baza tozalanadi. Hech qachon ishlab turgan (production) bazani bermang.
set -euo pipefail
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL o'rnatilmagan (faqat test uchun bo'sh baza)}"
cd "$(dirname "$0")/.."
PSQL=(psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "drop schema if exists public cascade; drop schema if exists auth cascade; drop schema if exists storage cascade; drop schema if exists extensions cascade; create schema public;" >/dev/null
for f in supabase/tests/supabase_stub.sql supabase/migrations/*.sql supabase/seed.sql supabase/tests/db_test.sql; do
  echo "→ $f"
  PGOPTIONS='-c client_min_messages=warning' "${PSQL[@]}" -f "$f" >/dev/null
done
echo "Barcha baza testlari o'tdi ✓"
