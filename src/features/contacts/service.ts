import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { createClient } from '@/lib/supabase/server';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { type Page, type ResolvedListParams } from '@/lib/pagination';
import * as repository from './repository';

/*
 * De vormen die een scherm mag kennen. Componenten importeren ze hiervandaan en
 * niet uit de repository: die is de databasekant en gaat langs de permissie-
 * controle heen.
 */
export type { ClientLinkRow, ContactLinkRow, ContactRow } from './repository';
import {
  type ContactFormInput,
  type ContactLinkInput,
  type ContactSort,
  type ContactUnlinkInput,
} from './schema';

export async function listContacts(
  organizationId: string,
  params: ResolvedListParams<ContactSort>,
): Promise<Page<repository.ContactRow>> {
  await requirePermission(organizationId, 'contacts.view');
  return repository.findContacts(organizationId, params);
}

export async function getContact(organizationId: string, contactId: string) {
  await requirePermission(organizationId, 'contacts.view');
  return repository.findContactById(organizationId, contactId);
}

export async function listClientsForContact(
  organizationId: string,
  contactId: string,
): Promise<repository.ClientLinkRow[]> {
  await requirePermission(organizationId, 'contacts.view');
  return repository.findClientsForContact(contactId);
}

export async function listContactsForClient(
  organizationId: string,
  clientId: string,
): Promise<repository.ContactLinkRow[]> {
  await requirePermission(organizationId, 'contacts.view');
  return repository.findContactsForClient(clientId);
}

export async function createContact(
  organizationId: string,
  input: ContactFormInput,
): Promise<Result<{ id: string }>> {
  const user = await requirePermission(organizationId, 'contacts.manage');

  const created = await repository.insertContact(organizationId, input);
  if (!created) {
    return err(new ConflictError('De contactpersoon kon niet worden opgeslagen.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'contact.created',
    entityType: 'contacts',
    entityId: created.id,
  });

  return ok(created);
}

export async function editContact(
  organizationId: string,
  contactId: string,
  input: ContactFormInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'contacts.manage');

  const updated = await repository.updateContact(organizationId, contactId, input);
  if (!updated) return err(new NotFoundError('Deze contactpersoon bestaat niet.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'contact.updated',
    entityType: 'contacts',
    entityId: contactId,
    changedFields: Object.keys(input),
  });

  return ok(null);
}

export async function removeContact(
  organizationId: string,
  contactId: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'contacts.manage');

  const deleted = await repository.softDeleteContact(organizationId, contactId);
  if (!deleted) return err(new NotFoundError('Deze contactpersoon bestaat niet.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'contact.updated',
    entityType: 'contacts',
    entityId: contactId,
    changedFields: ['deleted_at'],
  });

  return ok(null);
}

/**
 * Koppelt een contactpersoon aan een cliënt, of werkt de afspraken bij.
 *
 * DIT IS EEN TOEGANGSBESLUIT, GEEN ADMINISTRATIE. Wie hier een vinkje zet,
 * bepaalt wat iemand in het portaal te zien krijgt over een ander mens. De
 * controle dat allebei de kanten van de koppeling van dezelfde organisatie zijn
 * staat in migratie 0029 en niet hier: een insider met een gekopieerd id mag er
 * niet langs kunnen door de dienstlaag over te slaan.
 */
export async function linkContact(
  organizationId: string,
  input: ContactLinkInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'contacts.manage');
  const supabase = await createClient();

  // Beide kanten moeten zichtbaar zijn vanuit deze organisatie. RLS weigert de
  // koppeling ook, maar dan zonder uitleg aan de planner.
  const [client, contact] = await Promise.all([
    supabase
      .from('clients')
      .select('id')
      .eq('id', input.clientId)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('contacts')
      .select('id')
      .eq('id', input.contactId)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);

  if (!client.data) return err(new NotFoundError('Deze cliënt bestaat niet.'));
  if (!contact.data) return err(new NotFoundError('Deze contactpersoon bestaat niet.'));

  const { error } = await supabase.from('client_contacts').upsert(
    {
      client_id: input.clientId,
      contact_id: input.contactId,
      relationship: input.relationship,
      is_primary: input.isPrimary,
      can_view_rides: input.canViewRides,
      can_report_absence: input.canReportAbsence,
      can_request_changes: input.canRequestChanges,
    },
    { onConflict: 'client_id,contact_id' },
  );

  if (error) return err(new ConflictError('De koppeling kon niet worden opgeslagen.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'contact.linked',
    entityType: 'client_contacts',
    entityId: input.contactId,
    metadata: {
      client_id: input.clientId,
      can_view_rides: input.canViewRides,
      can_report_absence: input.canReportAbsence,
      can_request_changes: input.canRequestChanges,
    },
  });

  return ok(null);
}

export async function unlinkContact(
  organizationId: string,
  input: ContactUnlinkInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'contacts.manage');
  const supabase = await createClient();

  const { data } = await supabase
    .from('client_contacts')
    .delete()
    .eq('client_id', input.clientId)
    .eq('contact_id', input.contactId)
    .select('contact_id');

  if ((data ?? []).length === 0) {
    return err(new NotFoundError('Deze koppeling bestaat niet meer.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'contact.unlinked',
    entityType: 'client_contacts',
    entityId: input.contactId,
    metadata: { client_id: input.clientId },
  });

  return ok(null);
}
