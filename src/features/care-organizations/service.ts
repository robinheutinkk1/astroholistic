import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { createClient } from '@/lib/supabase/server';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { type Page, type ResolvedListParams } from '@/lib/pagination';
import * as repository from './repository';

export type { CareOrganizationRow, ClientFunderRow, FundedClientRow } from './repository';
import {
  type CareOrganizationFormInput,
  type CareOrganizationLinkInput,
  type CareOrganizationSort,
  type CareOrganizationUnlinkInput,
} from './schema';

export async function listCareOrganizations(
  organizationId: string,
  params: ResolvedListParams<CareOrganizationSort>,
): Promise<Page<repository.CareOrganizationRow>> {
  await requirePermission(organizationId, 'care_organizations.view');
  return repository.findCareOrganizations(organizationId, params);
}

export async function getCareOrganization(
  organizationId: string,
  careOrganizationId: string,
) {
  await requirePermission(organizationId, 'care_organizations.view');
  return repository.findCareOrganizationById(organizationId, careOrganizationId);
}

export async function listFundedClients(
  organizationId: string,
  careOrganizationId: string,
): Promise<repository.FundedClientRow[]> {
  await requirePermission(organizationId, 'care_organizations.view');
  return repository.findFundedClients(careOrganizationId);
}

export async function listFundersForClient(
  organizationId: string,
  clientId: string,
): Promise<repository.ClientFunderRow[]> {
  await requirePermission(organizationId, 'care_organizations.view');
  return repository.findFundersForClient(clientId);
}

export async function createCareOrganization(
  organizationId: string,
  input: CareOrganizationFormInput,
): Promise<Result<{ id: string }>> {
  const user = await requirePermission(organizationId, 'care_organizations.manage');

  const created = await repository.insertCareOrganization(organizationId, input);
  if (!created) {
    return err(new ConflictError('De zorgorganisatie kon niet worden opgeslagen.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'care_organization.created',
    entityType: 'care_organizations',
    entityId: created.id,
  });

  return ok(created);
}

export async function editCareOrganization(
  organizationId: string,
  careOrganizationId: string,
  input: CareOrganizationFormInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'care_organizations.manage');

  const updated = await repository.updateCareOrganization(
    organizationId,
    careOrganizationId,
    input,
  );
  if (!updated) return err(new NotFoundError('Deze zorgorganisatie bestaat niet.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'care_organization.updated',
    entityType: 'care_organizations',
    entityId: careOrganizationId,
    changedFields: Object.keys(input),
  });

  return ok(null);
}

export async function removeCareOrganization(
  organizationId: string,
  careOrganizationId: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'care_organizations.manage');

  const deleted = await repository.softDeleteCareOrganization(
    organizationId,
    careOrganizationId,
  );
  if (!deleted) return err(new NotFoundError('Deze zorgorganisatie bestaat niet.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'care_organization.updated',
    entityType: 'care_organizations',
    entityId: careOrganizationId,
    changedFields: ['deleted_at'],
  });

  return ok(null);
}

/**
 * Koppelt een cliënt aan zijn opdrachtgever, voor een periode.
 *
 * Hierdoor gaat de zorgcoördinator van die organisatie deze cliënt zien. Dat is
 * geen administratieve handeling maar het openzetten van een dossier voor een
 * partij buiten de vervoerder, en het staat daarom in de audit trail.
 */
export async function linkClient(
  organizationId: string,
  input: CareOrganizationLinkInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'care_organizations.manage');
  const supabase = await createClient();

  const [client, careOrg] = await Promise.all([
    supabase
      .from('clients')
      .select('id')
      .eq('id', input.clientId)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('care_organizations')
      .select('id')
      .eq('id', input.careOrganizationId)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);

  if (!client.data) return err(new NotFoundError('Deze cliënt bestaat niet.'));
  if (!careOrg.data) return err(new NotFoundError('Deze zorgorganisatie bestaat niet.'));

  const { error } = await supabase.from('client_care_organizations').insert({
    client_id: input.clientId,
    care_organization_id: input.careOrganizationId,
    valid_from: input.validFrom,
    valid_to: input.validTo,
  });

  if (error) {
    // 23505: er staat al een periode met exact dezelfde begindatum.
    return err(
      new ConflictError(
        error.code === '23505'
          ? 'Er loopt al een periode die op deze datum begint.'
          : 'De koppeling kon niet worden opgeslagen.',
      ),
    );
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'care_organization.client_linked',
    entityType: 'client_care_organizations',
    entityId: input.careOrganizationId,
    metadata: {
      client_id: input.clientId,
      valid_from: input.validFrom,
      // Het metadataveld neemt geen null; "open einde" is hier het antwoord.
      valid_to: input.validTo ?? 'open',
    },
  });

  return ok(null);
}

export async function unlinkClient(
  organizationId: string,
  input: CareOrganizationUnlinkInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'care_organizations.manage');
  const supabase = await createClient();

  const { data } = await supabase
    .from('client_care_organizations')
    .delete()
    .eq('client_id', input.clientId)
    .eq('care_organization_id', input.careOrganizationId)
    .eq('valid_from', input.validFrom)
    .select('client_id');

  if ((data ?? []).length === 0) {
    return err(new NotFoundError('Deze koppeling bestaat niet meer.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'care_organization.client_unlinked',
    entityType: 'client_care_organizations',
    entityId: input.careOrganizationId,
    metadata: { client_id: input.clientId, valid_from: input.validFrom },
  });

  return ok(null);
}
