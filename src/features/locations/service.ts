import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { type Page, type ResolvedListParams } from '@/lib/pagination';
import * as repository from './repository';
import { type LocationFormInput, type LocationSort } from './schema';

/**
 * Business rules for locations. Same shape as the other feature services:
 * permission check, repository call, audit entry, Result.
 */
export async function listLocations(
  organizationId: string,
  params: ResolvedListParams<LocationSort>,
): Promise<Page<repository.LocationRow>> {
  await requirePermission(organizationId, 'locations.view');
  return repository.findLocations(organizationId, params);
}

export async function getLocation(organizationId: string, id: string) {
  await requirePermission(organizationId, 'locations.view');
  return repository.findLocationById(organizationId, id);
}

export async function createLocation(
  organizationId: string,
  input: LocationFormInput,
): Promise<Result<{ id: string }>> {
  const user = await requirePermission(organizationId, 'locations.manage');

  const created = await repository.insertLocation(organizationId, input);
  if (!created) {
    return err(new ConflictError('De locatie kon niet worden opgeslagen.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'location.created',
    entityType: 'locations',
    entityId: created.id,
  });

  return ok(created);
}

export async function editLocation(
  organizationId: string,
  id: string,
  input: LocationFormInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'locations.manage');

  const existing = await repository.findLocationById(organizationId, id);
  if (!existing) return err(new NotFoundError('Deze locatie bestaat niet.'));

  const updated = await repository.updateLocation(organizationId, id, input);
  if (!updated) return err(new ConflictError('De locatie kon niet worden opgeslagen.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'location.updated',
    entityType: 'locations',
    entityId: id,
    changedFields: Object.keys(input),
  });

  return ok(null);
}

export async function removeLocation(
  organizationId: string,
  id: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'locations.manage');

  const existing = await repository.findLocationById(organizationId, id);
  if (!existing) return err(new NotFoundError('Deze locatie bestaat niet.'));

  const deleted = await repository.softDeleteLocation(organizationId, id);
  if (!deleted) return err(new ConflictError('Verwijderen is niet gelukt.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'location.deleted',
    entityType: 'locations',
    entityId: id,
  });

  return ok(null);
}
