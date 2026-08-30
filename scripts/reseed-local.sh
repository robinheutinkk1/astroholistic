#!/usr/bin/env bash
#
# Zet de lokale testdatabase terug naar een verse seed.
#
# WAAROM DIT BESTAAT. De seeds verankeren ritten met current_date. Een database
# die gisteren is gevuld heeft vandaag dus geen "rit van vandaag" meer, en dan
# vallen de check-in- en triptests om met NO_ACTIVE_RIDE. Dat is geen
# regressie maar veroudering; dit script is het antwoord.
#
# LET OP DE VOLGORDE. De truncate wist ook permissions en de systeemrollen,
# en die worden gevuld door migratie 0013 en niet door een seedbestand. Eerst
# die migratie, dan pas de seeds — andersom staan de rolkoppelingen naar
# niets te wijzen en heeft niemand meer rechten.
set -euo pipefail

DB="${TEST_DATABASE_ADMIN_URL:-postgresql://postgres@localhost:5433/postgres?host=/tmp}"

psql "$DB" -q <<'SQL'
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('truncate table public.%I cascade', t.tablename);
  end loop;
end $$;
truncate table auth.users cascade;
truncate table storage.objects cascade;
SQL

psql "$DB" -v ON_ERROR_STOP=1 -q \
  -f supabase/migrations/20260828000013_permissions_and_system_roles.sql

for file in supabase/seed/*.sql; do
  psql "$DB" -v ON_ERROR_STOP=1 -q -f "$file"
done

echo "Herseeded. Ritten staan weer op vandaag."
