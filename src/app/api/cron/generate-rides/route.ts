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
 * Nightly ride generation (Vercel Cron).
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

  return NextResponse.json({
    organizations: results.length,
    created: results.reduce((sum, result) => sum + result.created, 0),
    failed: results.filter((result) => result.error).length,
  });
}
