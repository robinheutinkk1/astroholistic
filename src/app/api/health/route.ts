import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';

/**
 * Liveness and readiness for monitoring.
 *
 * WHAT IT PROVES. Answering at all proves the application is up. The database
 * probe proves the rest of the chain: network to Supabase, PostgREST alive,
 * PostgreSQL alive, and our own migrations applied — because it calls a
 * function that only exists if migration 0021 ran.
 *
 * WHAT IT MUST NOT DO. No version numbers, no error text, no schema names, no
 * row counts. This endpoint is open by definition, so anything it returns is
 * public. A health check that helpfully reports "relation X does not exist" is
 * a free schema dump.
 *
 * `branding_for_host` is used because it is granted to `anon`, takes a
 * parameter we control, and returns nothing for an unknown host. The anon key
 * is deliberate: a health check that needs the service role would be checking
 * a privilege level nothing else uses.
 */
export const dynamic = 'force-dynamic';

/** A hostname nobody can register: .invalid is reserved (RFC 2606). */
const PROBE_HOST = 'health-probe.invalid';

/** A hanging database must produce a fast "unhealthy", not a hanging monitor. */
const TIMEOUT_MS = 3_000;

/**
 * Cached briefly so a monitor polling every second — or someone pointing a
 * load generator at this URL — cannot turn an open endpoint into database load.
 * Per instance, which is all a liveness probe needs.
 */
const CACHE_MS = 5_000;
let cached: { at: number; healthy: boolean } | null = null;

async function probeDatabase(): Promise<boolean> {
  const supabase = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const timeout = new Promise<false>((resolve) =>
    setTimeout(() => resolve(false), TIMEOUT_MS),
  );

  const query = supabase
    .rpc('branding_for_host', { p_host: PROBE_HOST })
    .then(({ error }) => !error);

  return Promise.race([query, timeout]);
}

export async function GET() {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) {
    return respond(cached.healthy);
  }

  let healthy: boolean;
  try {
    healthy = await probeDatabase();
  } catch {
    healthy = false;
  }

  cached = { at: now, healthy };
  return respond(healthy);
}

function respond(healthy: boolean) {
  return NextResponse.json(
    // Two fields, both of which a stranger may know.
    { status: healthy ? 'ok' : 'degraded', database: healthy },
    {
      status: healthy ? 200 : 503,
      headers: {
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    },
  );
}
