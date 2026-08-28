import 'server-only';
import { createClient } from '@/lib/supabase/server';

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
  | 'member.roles_changed'
  | 'member.suspended'
  | 'member.reactivated'
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
