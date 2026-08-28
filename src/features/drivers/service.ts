import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { type Page, type ResolvedListParams } from '@/lib/pagination';
import * as repository from './repository';
import { type DriverFormInput, type DriverSort } from './schema';

/**
 * Business rules for drivers. Same shape as the other feature services:
 * permission check, repository call, audit entry, Result.
 */
export async function listDrivers(
  organizationId: string,
  params: ResolvedListParams<DriverSort>,
): Promise<Page<repository.DriverRow>> {
  await requirePermission(organizationId, 'drivers.view');
  return repository.findDrivers(organizationId, params);
}

export async function getDriver(organizationId: string, id: string) {
  await requirePermission(organizationId, 'drivers.view');
  return repository.findDriverById(organizationId, id);
}

export async function createDriver(
  organizationId: string,
  input: DriverFormInput,
): Promise<Result<{ id: string }>> {
  const user = await requirePermission(organizationId, 'drivers.manage');

  const created = await repository.insertDriver(organizationId, input);
  if (!created) {
    return err(
      new ConflictError(
        'De chauffeur kon niet worden opgeslagen. Bestaat het medewerkernummer al?',
      ),
    );
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'driver.created',
    entityType: 'drivers',
    entityId: created.id,
  });

  return ok(created);
}

export async function editDriver(
  organizationId: string,
  id: string,
  input: DriverFormInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'drivers.manage');

  const existing = await repository.findDriverById(organizationId, id);
  if (!existing) return err(new NotFoundError('Deze chauffeur bestaat niet.'));

  const updated = await repository.updateDriver(organizationId, id, input);
  if (!updated)
    return err(
      new ConflictError(
        'De chauffeur kon niet worden opgeslagen. Bestaat het medewerkernummer al?',
      ),
    );

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'driver.updated',
    entityType: 'drivers',
    entityId: id,
    changedFields: Object.keys(input),
  });

  return ok(null);
}

export async function removeDriver(
  organizationId: string,
  id: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'drivers.manage');

  const existing = await repository.findDriverById(organizationId, id);
  if (!existing) return err(new NotFoundError('Deze chauffeur bestaat niet.'));

  // A driver with rides still ahead of them cannot simply disappear: the
  // planning would silently lose its assignee. Reassign first.
  const upcoming = await repository.countUpcomingRides(id);
  if (upcoming > 0) {
    return err(
      new ConflictError(
        `Deze chauffeur staat nog op ${upcoming} toekomstige ${upcoming === 1 ? 'rit' : 'ritten'}. Wijs die eerst aan iemand anders toe.`,
      ),
    );
  }

  const deleted = await repository.softDeleteDriver(organizationId, id);
  if (!deleted) return err(new ConflictError('Verwijderen is niet gelukt.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'driver.deleted',
    entityType: 'drivers',
    entityId: id,
  });

  return ok(null);
}
