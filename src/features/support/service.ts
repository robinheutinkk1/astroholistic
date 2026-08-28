import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import * as repository from './repository';
import { type GrantSupportInput, type RetentionInput } from './schema';

export type { SupportGrantRow } from './repository';

export async function listGrants(organizationId: string) {
  await requirePermission(organizationId, 'organization.manage');
  return repository.findGrants(organizationId);
}

export async function listPlatformStaff(organizationId: string) {
  await requirePermission(organizationId, 'organization.manage');
  return repository.findPlatformStaff();
}

/**
 * Grants platform support a time-boxed look inside.
 *
 * The audit entry is not optional here in the way it is elsewhere. This is the
 * one action in the product that lets someone outside the organisation read
 * inside it, so the record of who allowed it, for whom, how wide and for how
 * long is the whole accountability story (§53).
 */
export async function grantSupportAccess(
  organizationId: string,
  input: GrantSupportInput,
): Promise<Result<{ id: string }>> {
  const user = await requirePermission(organizationId, 'organization.manage');

  const created = await repository.insertGrant(organizationId, user.id, input);
  if (!created) {
    return err(new ConflictError('De toegang kon niet worden verleend.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'support.granted',
    entityType: 'support_access_grants',
    entityId: created.id,
    metadata: {
      scope: input.scope,
      duration_hours: input.durationHours,
      granted_to: input.grantedToUserId,
    },
  });

  return ok(created);
}

export async function revokeSupportAccess(
  organizationId: string,
  grantId: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'organization.manage');

  const revoked = await repository.revokeGrant(organizationId, grantId);
  if (!revoked) return err(new NotFoundError('Deze toegang bestaat niet meer.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'support.revoked',
    entityType: 'support_access_grants',
    entityId: grantId,
  });

  return ok(null);
}

export type { RetentionRow } from './repository';

export async function getRetention(organizationId: string) {
  await requirePermission(organizationId, 'organization.view');
  return repository.findRetention(organizationId);
}

export async function updateRetention(
  organizationId: string,
  input: RetentionInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'organization.manage');

  const saved = await repository.saveRetention(organizationId, input);
  if (!saved)
    return err(new ConflictError('De bewaartermijn kon niet worden opgeslagen.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'retention.applied',
    entityType: 'retention_policies',
    entityId: organizationId,
    metadata: {
      inactive_client_months: input.inactiveClientMonths,
      auto_anonymize_enabled: input.autoAnonymizeEnabled,
    },
  });

  return ok(null);
}
