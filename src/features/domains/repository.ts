import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { type Tables } from '@/types/database';

export type DomainRow = Pick<
  Tables<'organization_domains'>,
  | 'id'
  | 'hostname'
  | 'is_primary'
  | 'verification_status'
  | 'verification_token'
  | 'verified_at'
  | 'created_at'
>;

const COLUMNS =
  'id, hostname, is_primary, verification_status, verification_token, verified_at, created_at';

export async function findDomains(organizationId: string): Promise<DomainRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_domains')
    .select(COLUMNS)
    .eq('organization_id', organizationId)
    .order('is_primary', { ascending: false })
    .order('hostname', { ascending: true });
  return data ?? [];
}

export async function findDomainById(
  organizationId: string,
  id: string,
): Promise<DomainRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_domains')
    .select(COLUMNS)
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle();
  return data;
}

export type InsertOutcome =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly duplicate: boolean };

export async function insertDomain(
  organizationId: string,
  hostname: string,
): Promise<InsertOutcome> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organization_domains')
    .insert({ organization_id: organizationId, hostname })
    .select('id')
    .single();

  // 23505 is unique_violation: this organisation already listed the hostname.
  if (error) return { ok: false, duplicate: error.code === '23505' };
  return { ok: true, id: data.id };
}

export async function deleteDomain(organizationId: string, id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('organization_domains')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  return !error;
}

/**
 * Exactly one primary domain per organisation, enforced by a partial unique
 * index. Clearing the old one first is why this is two statements: the index
 * would reject the window where both are true.
 */
export async function setPrimaryDomain(
  organizationId: string,
  id: string,
): Promise<boolean> {
  const supabase = await createClient();
  const cleared = await supabase
    .from('organization_domains')
    .update({ is_primary: false })
    .eq('organization_id', organizationId)
    .eq('is_primary', true);
  if (cleared.error) return false;

  const { error } = await supabase
    .from('organization_domains')
    .update({ is_primary: true })
    .eq('organization_id', organizationId)
    .eq('id', id);
  return !error;
}
