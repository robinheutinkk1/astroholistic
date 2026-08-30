import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/features/rbac/session';

/**
 * Central audit logging (masterprompt §37).
 *
 * `metadata` carries changed field NAMES and identifiers, never the old and new
 * personal values (docs/SECURITY.md §11). Logging "name changed from Jan Jansen
 * to J. Jansen" would turn the audit log into a second, unprotected copy of the
 * client record.
 */
export type AuditAction =
  | 'client.created'
  | 'client.updated'
  | 'client.deleted'
  | 'contact.created'
  | 'contact.updated'
  | 'contact.linked'
  | 'contact.unlinked'
  | 'care_organization.created'
  | 'care_organization.updated'
  | 'care_organization.client_linked'
  | 'care_organization.client_unlinked'
  | 'driver.created'
  | 'driver.updated'
  | 'driver.deleted'
  | 'vehicle.created'
  | 'vehicle.updated'
  | 'vehicle.deleted'
  | 'location.created'
  | 'location.updated'
  | 'location.deleted'
  | 'ride.created'
  | 'ride.updated'
  | 'ride.cancelled'
  | 'ride.assigned'
  | 'ride.status_changed'
  | 'ride.force_status'
  | 'ride_template.created'
  | 'ride_template.updated'
  | 'ride_template.archived'
  | 'rides.generated'
  | 'tag.created'
  | 'tag.assigned'
  | 'tag.unassigned'
  | 'tag.status_changed'
  | 'tag.lost'
  | 'tag.checked_in'
  | 'change_request.submitted'
  | 'change_request.reviewed'
  | 'member.invited'
  | 'member.roles_changed'
  | 'member.suspended'
  | 'member.reactivated'
  | 'portal_access.granted'
  | 'portal_access.revoked'
  | 'branding.updated'
  | 'branding.logo_replaced'
  | 'branding.logo_removed'
  | 'domain.added'
  | 'domain.verified'
  | 'domain.verification_failed'
  | 'domain.removed'
  | 'domain.primary_changed'
  | 'report.exported'
  | 'support.granted'
  | 'support.revoked'
  | 'client.exported'
  | 'client.anonymized'
  | 'retention.applied';

export interface AuditEntry {
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly changedFields?: readonly string[];
  /**
   * Extra facts about the event. Identifiers, counts and dates only — never a
   * name, an address or anything else that would turn the audit trail into a
   * second copy of the personal data it is supposed to watch over (§38, §45).
   */
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from('audit_logs').insert({
    organization_id: entry.organizationId,
    actor_user_id: entry.actorUserId,
    actor_kind: 'PLANNER',
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    metadata: {
      ...(entry.changedFields ? { changed_fields: [...entry.changedFields] } : {}),
      ...(entry.metadata ?? {}),
    },
  });

  if (error) {
    // A failed audit write must not roll back the user's change — the record is
    // already saved and losing it would be worse. It must be loud in the logs.
    console.error('Audit log write failed', {
      action: entry.action,
      entityType: entry.entityType,
      code: error.code,
    });
  }
}

/** Field names that changed between two objects, for the audit metadata. */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): string[] {
  return Object.keys(after).filter(
    (key) => after[key] !== undefined && after[key] !== before[key],
  );
}

export interface AuditLogRow {
  readonly id: string;
  readonly createdAt: string;
  readonly action: string;
  readonly actorName: string | null;
  readonly actorKind: string;
  readonly entityType: string;
  readonly metadata: Record<string, unknown> | null;
}

export interface AuditLogPage {
  readonly rows: readonly AuditLogRow[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

const LOG_PAGE_SIZE = 50;

/**
 * Het logboek, leesbaar gemaakt.
 *
 * De tabel bestond en werd gevuld sinds fase 4; dit is de eerste plek waar
 * iemand hem zonder SQL kan inzien. Alleen lezen: de tabel is append-only en
 * `authenticated` heeft geen delete, dus dit scherm kan per constructie niets
 * kwijtmaken.
 */
export async function listAuditLog(
  organizationId: string,
  options: { page?: number; from?: string | null; to?: string | null } = {},
): Promise<AuditLogPage> {
  await requirePermission(organizationId, 'audit.view');
  const supabase = await createClient();

  const page = Math.max(1, options.page ?? 1);
  const rangeFrom = (page - 1) * LOG_PAGE_SIZE;

  let query = supabase
    .from('audit_logs')
    .select(
      'id, created_at, action, actor_kind, entity_type, metadata, actor:profiles!audit_logs_actor_user_id_fkey (full_name, email)',
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .range(rangeFrom, rangeFrom + LOG_PAGE_SIZE - 1);

  if (options.from) query = query.gte('created_at', `${options.from}T00:00:00Z`);
  // Tot en met: de dag zelf hoort erbij, dus de grens ligt op de dag erna.
  if (options.to) query = query.lt('created_at', `${options.to}T23:59:59.999Z`);

  const { data, count } = await query;
  const total = count ?? 0;

  return {
    page,
    total,
    pageCount: Math.max(1, Math.ceil(total / LOG_PAGE_SIZE)),
    rows: (data ?? []).map((row) => {
      const actor = row.actor as unknown as {
        full_name: string | null;
        email: string;
      } | null;
      return {
        id: row.id,
        createdAt: row.created_at,
        action: row.action,
        // Een actor die RLS niet vrijgeeft (of het systeem zelf) toont als
        // zodanig, nooit als lege cel.
        actorName: actor ? (actor.full_name ?? actor.email) : null,
        actorKind: row.actor_kind,
        entityType: row.entity_type,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      };
    }),
  };
}
