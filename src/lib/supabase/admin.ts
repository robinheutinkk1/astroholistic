import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { serverEnv } from '@/lib/env.server';
import { type Database } from '@/types/database';

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY COMPLETELY.
 *
 * ESLint forbids importing this module from anywhere else in src/ (see
 * eslint.config.mjs). It exists for exactly three jobs, all of which genuinely
 * need to act outside a user session:
 *
 *   1. inviting users (writing to auth.users)
 *   2. the scheduled ride-generation job (no signed-in user exists)
 *   3. the GDPR erasure pipeline
 *
 * Every call must scope to a single organisation. `withOrganizationScope` below
 * exists so that "forgot to filter" is a type error rather than a data leak.
 */
function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Runs a service-role operation against exactly one organisation.
 *
 * The organisation id is a required parameter and is passed into the callback,
 * so the tenant boundary that RLS would normally enforce is at least explicit
 * and greppable at every call site.
 */
export async function withOrganizationScope<T>(
  organizationId: string,
  operation: (client: AdminClient, organizationId: string) => Promise<T>,
): Promise<T> {
  if (!organizationId) {
    throw new Error(
      'withOrganizationScope requires an organization id: service-role queries must never run unscoped.',
    );
  }
  return operation(createAdminClient(), organizationId);
}

/**
 * Unscoped service-role access, for the few operations that are genuinely
 * platform-wide (creating an organisation, the nightly generation sweep).
 *
 * The verbose name is the point: it should look wrong in a diff.
 */
export function createUnscopedAdminClient(reason: string): AdminClient {
  if (!reason) {
    throw new Error('createUnscopedAdminClient requires a documented reason.');
  }
  return createAdminClient();
}
