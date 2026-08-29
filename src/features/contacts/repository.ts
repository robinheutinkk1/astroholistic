import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  escapeSearchTerm,
  toPage,
  type Page,
  type ResolvedListParams,
} from '@/lib/pagination';
import { type Tables } from '@/types/database';
import { type ContactFormInput, type ContactSort } from './schema';

export type ContactRow = Pick<
  Tables<'contacts'>,
  'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status' | 'user_id'
>;

const LIST_COLUMNS = 'id, first_name, last_name, phone, email, status, user_id';

export async function findContacts(
  organizationId: string,
  params: ResolvedListParams<ContactSort>,
): Promise<Page<ContactRow>> {
  const supabase = await createClient();
  let query = supabase
    .from('contacts')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (params.search) {
    const term = `%${escapeSearchTerm(params.search)}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
    );
  }

  const { data, count } = await query
    .order(params.sort, { ascending: params.ascending })
    .order('id', { ascending: true })
    .range(params.from, params.to);

  return toPage(data ?? [], count ?? 0, params);
}

export async function findContactById(organizationId: string, contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', contactId)
    .is('deleted_at', null)
    .maybeSingle();
  return data;
}

function toRecord(input: ContactFormInput) {
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    email: input.email,
    status: input.status,
  };
}

export async function insertContact(organizationId: string, input: ContactFormInput) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .insert({ organization_id: organizationId, ...toRecord(input) })
    .select('id')
    .single();
  return data;
}

export async function updateContact(
  organizationId: string,
  contactId: string,
  input: ContactFormInput,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .update(toRecord(input))
    .eq('organization_id', organizationId)
    .eq('id', contactId)
    .select('id')
    .maybeSingle();
  return data;
}

/** Zacht verwijderen: de koppelingen en de ritgeschiedenis blijven staan. */
export async function softDeleteContact(organizationId: string, contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .update({ deleted_at: new Date().toISOString(), status: 'INACTIVE' })
    .eq('organization_id', organizationId)
    .eq('id', contactId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  return data;
}

export interface ClientLinkRow {
  readonly clientId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly relationship: string | null;
  readonly isPrimary: boolean;
  readonly canViewRides: boolean;
  readonly canReportAbsence: boolean;
  readonly canRequestChanges: boolean;
}

/** De cliënten waar deze contactpersoon aan hangt. */
export async function findClientsForContact(contactId: string): Promise<ClientLinkRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('client_contacts')
    .select(
      `relationship, is_primary, can_view_rides, can_report_absence, can_request_changes,
       client:clients!client_contacts_client_id_fkey (id, first_name, last_name, deleted_at)`,
    )
    .eq('contact_id', contactId);

  return (data ?? [])
    .map((row) => {
      const client = row.client as unknown as {
        id: string;
        first_name: string;
        last_name: string;
        deleted_at: string | null;
      } | null;
      if (!client || client.deleted_at) return null;
      return {
        clientId: client.id,
        firstName: client.first_name,
        lastName: client.last_name,
        relationship: row.relationship,
        isPrimary: row.is_primary,
        canViewRides: row.can_view_rides,
        canReportAbsence: row.can_report_absence,
        canRequestChanges: row.can_request_changes,
      };
    })
    .filter((row): row is ClientLinkRow => row !== null);
}

export interface ContactLinkRow {
  readonly contactId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly userId: string | null;
  readonly relationship: string | null;
  readonly isPrimary: boolean;
  readonly canViewRides: boolean;
  readonly canReportAbsence: boolean;
  readonly canRequestChanges: boolean;
}

/** De contactpersonen die aan deze cliënt hangen. */
export async function findContactsForClient(clientId: string): Promise<ContactLinkRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('client_contacts')
    .select(
      `relationship, is_primary, can_view_rides, can_report_absence, can_request_changes,
       contact:contacts!client_contacts_contact_id_fkey
         (id, first_name, last_name, phone, email, user_id, deleted_at)`,
    )
    .eq('client_id', clientId);

  return (data ?? [])
    .map((row) => {
      const contact = row.contact as unknown as {
        id: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        email: string | null;
        user_id: string | null;
        deleted_at: string | null;
      } | null;
      if (!contact || contact.deleted_at) return null;
      return {
        contactId: contact.id,
        firstName: contact.first_name,
        lastName: contact.last_name,
        phone: contact.phone,
        email: contact.email,
        userId: contact.user_id,
        relationship: row.relationship,
        isPrimary: row.is_primary,
        canViewRides: row.can_view_rides,
        canReportAbsence: row.can_report_absence,
        canRequestChanges: row.can_request_changes,
      };
    })
    .filter((row): row is ContactLinkRow => row !== null)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}
