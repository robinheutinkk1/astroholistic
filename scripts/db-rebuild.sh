#!/usr/bin/env bash
# Rebuilds the local test database from zero: bootstrap shim, then every
# migration in filename order. Must succeed on every commit — a migration that
# only works against an already-migrated database is not reproducible (§40).
set -euo pipefail
PSQL=(psql -h /tmp -p "${PGPORT:-5433}" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -c "drop schema if exists public cascade;
                 drop schema if exists app cascade;
                 drop schema if exists auth cascade;
                 drop schema if exists storage cascade;
                 create schema public;" >/dev/null

"${PSQL[@]}" -f supabase/testing/bootstrap-local.sql >/dev/null 2>&1

for file in supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$file" >/dev/null
  echo "  applied $(basename "$file")"
done
echo "database rebuilt"
