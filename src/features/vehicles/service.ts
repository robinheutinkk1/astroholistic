import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { type Page, type ResolvedListParams } from '@/lib/pagination';
import * as repository from './repository';
import { type VehicleFormInput, type VehicleSort } from './schema';

/**
 * Business rules for vehicles. Same shape as the other feature services:
 * permission check, repository call, audit entry, Result.
 */
export async function listVehicles(
  organizationId: string,
  params: ResolvedListParams<VehicleSort>,
): Promise<Page<repository.VehicleRow>> {
  await requirePermission(organizationId, 'vehicles.view');
  return repository.findVehicles(organizationId, params);
}

export async function getVehicle(organizationId: string, id: string) {
  await requirePermission(organizationId, 'vehicles.view');
  return repository.findVehicleById(organizationId, id);
}

export async function createVehicle(
  organizationId: string,
  input: VehicleFormInput,
): Promise<Result<{ id: string }>> {
  const user = await requirePermission(organizationId, 'vehicles.manage');

  const created = await repository.insertVehicle(organizationId, input);
  if (!created) {
    return err(
      new ConflictError(
        'Het voertuig kon niet worden opgeslagen. Bestaat het kenteken al?',
      ),
    );
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'vehicle.created',
    entityType: 'vehicles',
    entityId: created.id,
  });

  return ok(created);
}

export async function editVehicle(
  organizationId: string,
  id: string,
  input: VehicleFormInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'vehicles.manage');

  const existing = await repository.findVehicleById(organizationId, id);
  if (!existing) return err(new NotFoundError('Dit voertuig bestaat niet.'));

  const updated = await repository.updateVehicle(organizationId, id, input);
  if (!updated)
    return err(
      new ConflictError(
        'Het voertuig kon niet worden opgeslagen. Bestaat het kenteken al?',
      ),
    );

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'vehicle.updated',
    entityType: 'vehicles',
    entityId: id,
    changedFields: Object.keys(input),
  });

  return ok(null);
}

export async function removeVehicle(
  organizationId: string,
  id: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'vehicles.manage');

  const existing = await repository.findVehicleById(organizationId, id);
  if (!existing) return err(new NotFoundError('Dit voertuig bestaat niet.'));

  const deleted = await repository.softDeleteVehicle(organizationId, id);
  if (!deleted) return err(new ConflictError('Verwijderen is niet gelukt.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'vehicle.deleted',
    entityType: 'vehicles',
    entityId: id,
  });

  return ok(null);
}
