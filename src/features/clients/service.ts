import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { type Page, type ResolvedListParams } from '@/lib/pagination';
import { type Tables } from '@/types/database';
import * as repository from './repository';
import { type ClientFormInput, type ClientSort } from './schema';

/**
 * Business rules for clients. Every mutation checks a permission, writes an
 * audit entry, and returns a Result rather than throwing on expected failures.
 */
export async function listClients(
  organizationId: string,
  params: ResolvedListParams<ClientSort>,
): Promise<Page<repository.ClientRow>> {
  await requirePermission(organizationId, 'clients.view');
  return repository.findClients(organizationId, params);
}

export async function getClient(
  organizationId: string,
  clientId: string,
): Promise<Tables<'clients'> | null> {
  await requirePermission(organizationId, 'clients.view');
  return repository.findClientById(organizationId, clientId);
}

export async function createClient(
  organizationId: string,
  input: ClientFormInput,
): Promise<Result<{ id: string }>> {
  const user = await requirePermission(organizationId, 'clients.create');

  const created = await repository.insertClient(organizationId, input);
  if (!created) {
    // The most likely cause is the unique index on (organization_id,
    // external_reference), so say that rather than "something went wrong".
    return err(
      new ConflictError(
        'De cliënt kon niet worden opgeslagen. Bestaat de interne referentie al?',
      ),
    );
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'client.created',
    entityType: 'clients',
    entityId: created.id,
  });

  return ok(created);
}

export async function editClient(
  organizationId: string,
  clientId: string,
  input: ClientFormInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'clients.update');

  const existing = await repository.findClientById(organizationId, clientId);
  if (!existing) return err(new NotFoundError('Deze cliënt bestaat niet.'));

  const updated = await repository.updateClient(organizationId, clientId, input);
  if (!updated) {
    return err(new ConflictError('De wijziging kon niet worden opgeslagen.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'client.updated',
    entityType: 'clients',
    entityId: clientId,
    // Field names only — never the old and new values (docs/SECURITY.md §11).
    changedFields: Object.keys(input),
  });

  return ok(null);
}

export async function removeClient(
  organizationId: string,
  clientId: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'clients.delete');

  const existing = await repository.findClientById(organizationId, clientId);
  if (!existing) return err(new NotFoundError('Deze cliënt bestaat niet.'));

  const deleted = await repository.softDeleteClient(organizationId, clientId);
  if (!deleted) return err(new ConflictError('De cliënt kon niet worden verwijderd.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'client.deleted',
    entityType: 'clients',
    entityId: clientId,
  });

  return ok(null);
}
