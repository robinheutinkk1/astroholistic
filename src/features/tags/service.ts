import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { requirePermission, requireUser } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { requireSecret } from '@/lib/env.server';
import { createClient } from '@/lib/supabase/server';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { encodeBase32, formatPublicCode, organizationPrefix, TOKEN_BYTES } from './token';

/**
 * Tagpoint tags. One tag, one token, one status model — QR is a rendering of
 * the same URL, not a second system (decision D-05).
 */

/**
 * Hashes a token for storage and lookup.
 *
 * SHA-256 rather than bcrypt: this is a 128-bit random value, not a password,
 * so there is nothing to brute force and the lookup happens on every scan. The
 * pepper lives outside the database, so a dump alone cannot be turned into
 * working tag URLs even with a dictionary.
 */
export function hashToken(token: string): Buffer {
  const pepper = requireSecret('TAG_TOKEN_PEPPER');
  return createHash('sha256').update(`${token}${pepper}`).digest();
}

export interface TagListItem {
  readonly id: string;
  readonly public_code: string;
  readonly status: 'UNASSIGNED' | 'ACTIVE' | 'INACTIVE' | 'LOST' | 'REPLACED';
  readonly label: string | null;
  readonly activated_at: string | null;
  readonly client: { id: string; first_name: string; last_name: string } | null;
}

export async function listTags(organizationId: string): Promise<TagListItem[]> {
  await requirePermission(organizationId, 'tags.view');
  const supabase = await createClient();

  const { data } = await supabase
    .from('nfc_tags')
    .select(
      `id, public_code, status, label, activated_at,
       client:clients!nfc_tags_client_id_fkey (id, first_name, last_name)`,
    )
    .eq('organization_id', organizationId)
    .order('public_code', { ascending: true });

  return data ?? [];
}

/**
 * Creates a tag and returns the token ONCE.
 *
 * The token is never stored, only its hash, so this is the only moment it can
 * be written to a physical tag or printed as a QR code. A tag whose token is
 * lost is replaced, not recovered — the same trade-off as an API key, for the
 * same reason (docs/NFC.md §10).
 */
export async function createTag(
  organizationId: string,
  label: string | null,
): Promise<Result<{ id: string; publicCode: string; token: string }>> {
  const user = await requirePermission(organizationId, 'tags.manage');
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', organizationId)
    .maybeSingle();

  const token = encodeBase32(randomBytes(TOKEN_BYTES));
  const publicCode = formatPublicCode(
    organizationPrefix(organization?.slug ?? 'taxi'),
    encodeBase32(randomBytes(4)).slice(0, 6),
  );

  const { data: created, error } = await supabase
    .from('nfc_tags')
    .insert({
      organization_id: organizationId,
      public_code: publicCode,
      token_hash: `\\x${hashToken(token).toString('hex')}`,
      status: 'UNASSIGNED',
      label,
      created_by: user.id,
    })
    .select('id')
    .maybeSingle();

  if (error || !created) {
    return err(new ConflictError('De tag kon niet worden aangemaakt.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'tag.created',
    entityType: 'nfc_tags',
    entityId: created.id,
  });

  return ok({ id: created.id, publicCode, token });
}

export async function assignTag(
  organizationId: string,
  tagId: string,
  clientId: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'tags.manage');
  const supabase = await createClient();

  const { data: tag } = await supabase
    .from('nfc_tags')
    .select('id, status, client_id')
    .eq('organization_id', organizationId)
    .eq('id', tagId)
    .maybeSingle();
  if (!tag) return err(new NotFoundError('Deze tag bestaat niet.'));

  if (tag.status === 'LOST' || tag.status === 'REPLACED') {
    return err(
      new ConflictError(
        'Deze tag is als verloren of vervangen gemarkeerd en kan niet meer worden gekoppeld.',
      ),
    );
  }

  const { error } = await supabase
    .from('nfc_tags')
    .update({
      client_id: clientId,
      status: 'ACTIVE',
      activated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('id', tagId);

  if (error) {
    // The most likely cause is the unique index enforcing one active tag per
    // client, so say that instead of "something went wrong".
    return err(
      new ConflictError('Koppelen is niet gelukt. Heeft deze cliënt al een actieve tag?'),
    );
  }

  await supabase.from('tag_assignments').insert({
    organization_id: organizationId,
    nfc_tag_id: tagId,
    client_id: clientId,
    assigned_by: user.id,
  });

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'tag.assigned',
    entityType: 'nfc_tags',
    entityId: tagId,
  });

  return ok(null);
}

export async function unassignTag(
  organizationId: string,
  tagId: string,
  reason: string | null,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'tags.manage');
  const supabase = await createClient();

  const { error } = await supabase
    .from('nfc_tags')
    .update({ client_id: null, status: 'UNASSIGNED' })
    .eq('organization_id', organizationId)
    .eq('id', tagId);
  if (error) return err(new ConflictError('Ontkoppelen is niet gelukt.'));

  await supabase
    .from('tag_assignments')
    .update({ unassigned_at: new Date().toISOString(), unassigned_by: user.id, reason })
    .eq('nfc_tag_id', tagId)
    .is('unassigned_at', null);

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'tag.unassigned',
    entityType: 'nfc_tags',
    entityId: tagId,
  });

  return ok(null);
}

export async function setTagStatus(
  organizationId: string,
  tagId: string,
  status: 'ACTIVE' | 'INACTIVE' | 'LOST',
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'tags.manage');
  const supabase = await createClient();

  const { data: tag } = await supabase
    .from('nfc_tags')
    .select('client_id')
    .eq('organization_id', organizationId)
    .eq('id', tagId)
    .maybeSingle();
  if (!tag) return err(new NotFoundError('Deze tag bestaat niet.'));

  if (status === 'ACTIVE' && !tag.client_id) {
    return err(new ConflictError('Koppel de tag eerst aan een cliënt.'));
  }

  // A lost tag loses its client immediately: whoever finds it must not be able
  // to check anyone in with it.
  const patch = status === 'LOST' ? { status, client_id: null } : { status };

  const { error } = await supabase
    .from('nfc_tags')
    .update(patch)
    .eq('organization_id', organizationId)
    .eq('id', tagId);
  if (error) return err(new ConflictError('De status kon niet worden gewijzigd.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: status === 'LOST' ? 'tag.lost' : 'tag.status_changed',
    entityType: 'nfc_tags',
    entityId: tagId,
  });

  return ok(null);
}

export type CheckinOutcome =
  | 'CHECKED_IN'
  | 'ALREADY_CHECKED_IN'
  | 'NO_ACTIVE_RIDE'
  | 'NO_ACCESS'
  | 'UNKNOWN_TAG'
  | 'NOT_ALLOWED'
  | 'RATE_LIMITED';

export interface CheckinResult {
  readonly outcome: CheckinOutcome;
  readonly rideId: string | null;
  readonly clientName: string | null;
  readonly occurredAt: string | null;
}

/**
 * Resolves a scanned token and checks the client in.
 *
 * All of the decision-making happens inside one database function so the event
 * and the status change cannot come apart. This wrapper only translates.
 */
export async function checkinByToken(
  token: string,
  source: 'NFC' | 'QR' | 'MANUAL' = 'NFC',
): Promise<CheckinResult> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('checkin_by_tag_token', {
    p_token_hash: `\\x${hashToken(token).toString('hex')}`,
    p_source: source,
  });

  if (error || !data || data.length === 0) {
    if (error) {
      console.error('Check-in RPC failed', { code: error.code });
    }
    return { outcome: 'UNKNOWN_TAG', rideId: null, clientName: null, occurredAt: null };
  }

  const row = data[0];
  if (!row?.outcome) {
    return { outcome: 'UNKNOWN_TAG', rideId: null, clientName: null, occurredAt: null };
  }

  return {
    outcome: row.outcome,
    rideId: row.ride_id,
    clientName:
      row.client_first_name && row.client_last_name
        ? `${row.client_first_name} ${row.client_last_name}`
        : null,
    occurredAt: row.occurred_at,
  };
}
