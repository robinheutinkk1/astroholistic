#!/usr/bin/env bash
# Starts a bare PostgreSQL 16 cluster for migration and RLS testing.
#
# WHY THIS EXISTS
# ---------------
# The normal path is `npm run db:start` (the Supabase CLI's Docker stack). In
# environments where Docker Hub is unreachable — a restricted CI runner, a
# locked-down corporate network — that is not available.
#
# Row Level Security is plain PostgreSQL, so the tenant-isolation suite does not
# actually need Supabase to run. This script provides a cluster; the migration
# in supabase/migrations that creates the `auth` schema shims auth.uid() and the
# anon/authenticated/service_role roles the same way Supabase defines them.
#
# Use the Docker stack when you can: it also exercises PostgREST and GoTrue.
# Use this when you cannot.
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGPORT="${PGPORT:-5433}"
PGUSER_OS="${PGUSER_OS:-pgtest}"
PGDATA="${PGDATA:-/home/${PGUSER_OS}/pgdata}"

case "${1:-start}" in
  start)
    if ! id "$PGUSER_OS" >/dev/null 2>&1; then
      useradd -m "$PGUSER_OS"
    fi
    if [ ! -f "$PGDATA/PG_VERSION" ]; then
      mkdir -p "$PGDATA"
      chown -R "$PGUSER_OS:$PGUSER_OS" "$(dirname "$PGDATA")"
      su "$PGUSER_OS" -c "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust"
    fi
    su "$PGUSER_OS" -c "$PGBIN/pg_ctl -D $PGDATA -o '-p $PGPORT -k /tmp' -l /home/$PGUSER_OS/pg.log start"
    echo "postgresql://postgres@localhost:$PGPORT/postgres"
    ;;
  stop)
    su "$PGUSER_OS" -c "$PGBIN/pg_ctl -D $PGDATA stop" || true
    ;;
  reset)
    "$0" stop
    rm -rf "$PGDATA"
    "$0" start
    ;;
  *)
    echo "usage: $0 {start|stop|reset}" >&2
    exit 1
    ;;
esac
