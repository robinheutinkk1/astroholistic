import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { type Tables } from '@/types/database';
import { type GrantSupportInput, type RetentionInput } from './schema';

export interface SupportGrantRow {
  readonly id: string;
  readonly reason: string;
  readonly scope: Tables<'support_access_grants'>['scope'];
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly createdAt: string;
  readonly grantedToName: string | null;
  readonly grantedToEmail: string | null;
  readonly grantedByName: string | null;
}

const COLUMNS =
  'id, reason, scope, expires_at, revoked_at, created_at, granted_to_user_id, granted_by_user_id';

export async function findGrants(organizationId: string): Promise<SupportGrantRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('support_access_grants')
    .select(COLUMNS)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Names come from a second query rather than an embedded join: PostgREST
  // cannot embed the same table twice through two different foreign keys
  // without an ambiguity error, and two of these columns point at `profiles`.
  const ids = [
    ...new Set(rows.flatMap((row) => [row.granted_to_user_id, row.granted_by_user_id])),
  ];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', ids);

  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    scope: row.scope,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    grantedToName: byId.get(row.granted_to_user_id)?.full_name ?? null,
    grantedToEmail: byId.get(row.granted_to_user_id)?.email ?? null,
    grantedByName: byId.get(row.granted_by_user_id)?.full_name ?? null,
  }));
}

/**
 * Platform staff, so the organisation grants access to a person, not a uuid.
 *
 * Two queries again, and for the same reason: platform_admins points at
 * profiles through more than one column, so an embed is ambiguous.
 */
export async function findPlatformStaff() {
  const supabase = await createClient();
  const { data: admins } = await supabase.from('platform_admins').select('user_id');

  const ids = (admins ?? []).map((row) => row.user_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', ids)
    .order('full_name');

  return (profiles ?? []).map((profile) => ({
    id: profile.id,
    // A profile without a name is a real state (an invited account that never
    // signed in). Showing the e-mail is better than showing an empty option
    // that the organisation cannot tell apart from the next one.
    name: profile.full_name ?? profile.email ?? 'Onbekende medewerker',
    email: profile.email ?? '',
  }));
}

export async function insertGrant(
  organizationId: string,
  grantedByUserId: string,
  input: GrantSupportInput,
): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const expiresAt = new Date(
    Date.now() + input.durationHours * 60 * 60 * 1000,
  ).toISOString();

  const { data } = await supabase
    .from('support_access_grants')
    .insert({
      organization_id: organizationId,
      granted_to_user_id: input.grantedToUserId,
      granted_by_user_id: grantedByUserId,
      reason: input.reason,
      scope: input.scope,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  return data;
}

export async function revokeGrant(
  organizationId: string,
  grantId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('support_access_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .eq('id', grantId)
    .is('revoked_at', null);
  return !error;
}

export interface RetentionRow {
  readonly inactiveClientMonths: number;
  readonly autoAnonymizeEnabled: boolean;
}

const RETENTION_DEFAULTS: RetentionRow = {
  inactiveClientMonths: 24,
  autoAnonymizeEnabled: false,
};

export async function findRetention(organizationId: string): Promise<RetentionRow> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('retention_policies')
    .select('inactive_client_months, auto_anonymize_enabled')
    .eq('organization_id', organizationId)
    .maybeSingle();

  // An organisation without a row has the defaults, and those defaults are the
  // same ones the table declares. Showing "not configured" would invite the
  // reader to assume nothing happens, which is only half true.
  if (!data) return RETENTION_DEFAULTS;
  return {
    inactiveClientMonths: data.inactive_client_months,
    autoAnonymizeEnabled: data.auto_anonymize_enabled,
  };
}

export async function saveRetention(
  organizationId: string,
  input: RetentionInput,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from('retention_policies').upsert(
    {
      organization_id: organizationId,
      inactive_client_months: input.inactiveClientMonths,
      auto_anonymize_enabled: input.autoAnonymizeEnabled,
    },
    { onConflict: 'organization_id' },
  );
  return !error;
}
