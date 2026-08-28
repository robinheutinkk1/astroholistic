import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';

/*
 * The nightly job runs with no signed-in user, so RLS has no identity to work
 * from and the service-role client is the only option. Access is gated by
 * CRON_SECRET below, and the job only ever inserts generated rides.
 */
// eslint-disable-next-line no-restricted-imports
import { createUnscopedAdminClient } from '@/lib/supabase/admin';
import { optionalSecret } from '@/lib/env.server';
import { generateRidesForOrganization } from '@/features/ride-templates/generation';

/**
 * The nightly job: ride generation, the retention sweep and housekeeping.
 *
 * Runs for every active organisation. It is idempotent, so a retried or
 * double-fired schedule is harmless — that property is what makes an unattended
 * job safe to run at all.
 */
export async function POST(request: NextRequest) {
  const secret = optionalSecret('CRON_SECRET');

  // An unconfigured secret must close the endpoint, not crash it: a 500 with a
  // stack trace names the variable that is missing.
  if (!secret) {
    console.error('CRON_SECRET is not configured; ride generation endpoint is closed.');
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  // Without this check the endpoint is a public write.
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createUnscopedAdminClient(
    'nightly ride generation: runs for all organisations, with no signed-in user',
  );

  const { data: organizations } = await admin
    .from('organizations')
    .select('id')
    .in('status', ['TRIAL', 'ACTIVE'])
    .is('deleted_at', null);

  const results: { organizationId: string; created: number; error?: string }[] = [];

  for (const organization of organizations ?? []) {
    try {
      // Explicitly the admin client: there is no session to inherit here.
      const result = await generateRidesForOrganization(organization.id, admin);
      results.push({ organizationId: organization.id, created: result.created });
    } catch (error) {
      // One organisation failing must not stop the rest: the others still need
      // tomorrow's rides.
      console.error('Ride generation failed for organisation', {
        organizationId: organization.id,
        message: error instanceof Error ? error.message : 'unknown',
      });
      results.push({ organizationId: organization.id, created: 0, error: 'failed' });
    }
  }

  // Housekeeping runs after the work that matters. If generation failed for an
  // organisation we still want the sweeps to happen — they are what keeps the
  // retention promise and stops the rate-limit table growing without end.
  let anonymized = 0;
  for (const organization of organizations ?? []) {
    try {
      const { data } = await admin.rpc('apply_retention', {
        p_organization_id: organization.id,
      });
      anonymized += data ?? 0;
    } catch (error) {
      console.error('Retention sweep failed for organisation', {
        organizationId: organization.id,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  let rateLimitRowsRemoved = 0;
  try {
    const { data } = await admin.rpc('sweep_rate_limit_hits', { p_older_than_hours: 24 });
    rateLimitRowsRemoved = data ?? 0;
  } catch (error) {
    console.error('Rate-limit sweep failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
  }

  return NextResponse.json({
    organizations: results.length,
    created: results.reduce((sum, result) => sum + result.created, 0),
    failed: results.filter((result) => result.error).length,
    anonymized,
    rateLimitRowsRemoved,
  });
}
