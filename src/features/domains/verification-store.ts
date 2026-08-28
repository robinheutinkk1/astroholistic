import 'server-only';
/*
 * The fourth legitimate service-role job (see src/lib/supabase/admin.ts).
 *
 * A tenant may add and remove their own domains, but they may not declare one
 * verified — a trigger added in migration 0021 rejects that even for a request
 * crafted straight against PostgREST with their own token. The server writes
 * the outcome instead, after checking DNS itself. Scoped to one organisation,
 * and the only columns it touches are the three the trigger protects.
 */
// eslint-disable-next-line no-restricted-imports
import { withOrganizationScope } from '@/lib/supabase/admin';

export type VerificationWrite = 'WRITTEN' | 'TAKEN' | 'FAILED';

export async function markVerified(
  organizationId: string,
  domainId: string,
): Promise<VerificationWrite> {
  return withOrganizationScope(organizationId, async (client, scopedOrganizationId) => {
    const { error } = await client
      .from('organization_domains')
      .update({ verification_status: 'VERIFIED', verified_at: new Date().toISOString() })
      .eq('organization_id', scopedOrganizationId)
      .eq('id', domainId);

    if (!error) return 'WRITTEN';
    // 23505 on the partial unique index: another organisation proved ownership
    // of this hostname first. Losing that race is a legitimate outcome, not a
    // bug, and the tenant deserves to be told which of the two it was.
    return error.code === '23505' ? 'TAKEN' : 'FAILED';
  });
}

export async function markFailed(
  organizationId: string,
  domainId: string,
): Promise<boolean> {
  return withOrganizationScope(organizationId, async (client, scopedOrganizationId) => {
    const { error } = await client
      .from('organization_domains')
      .update({ verification_status: 'FAILED', verified_at: null })
      .eq('organization_id', scopedOrganizationId)
      .eq('id', domainId);
    return !error;
  });
}
