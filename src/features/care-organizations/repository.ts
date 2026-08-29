import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  escapeSearchTerm,
  toPage,
  type Page,
  type ResolvedListParams,
} from '@/lib/pagination';
import { type Tables } from '@/types/database';
import { type CareOrganizationFormInput, type CareOrganizationSort } from './schema';

export type CareOrganizationRow = Pick<
  Tables<'care_organizations'>,
  'id' | 'name' | 'contact_email' | 'phone' | 'city' | 'status'
>;

const LIST_COLUMNS = 'id, name, contact_email, phone, city, status';

export async function findCareOrganizations(
  organizationId: string,
  params: ResolvedListParams<CareOrganizationSort>,
): Promise<Page<CareOrganizationRow>> {
  const supabase = await createClient();
  let query = supabase
    .from('care_organizations')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (params.search) {
    const term = `%${escapeSearchTerm(params.search)}%`;
    query = query.or(`name.ilike.${term},city.ilike.${term},contact_email.ilike.${term}`);
  }

  const { data, count } = await query
    .order(params.sort, { ascending: params.ascending })
    .order('id', { ascending: true })
    .range(params.from, params.to);

  return toPage(data ?? [], count ?? 0, params);
}

export async function findCareOrganizationById(
  organizationId: string,
  careOrganizationId: string,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('care_organizations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', careOrganizationId)
    .is('deleted_at', null)
    .maybeSingle();
  return data;
}

function toRecord(input: CareOrganizationFormInput) {
  return {
    name: input.name,
    contact_email: input.contactEmail,
    phone: input.phone,
    address_line1: input.addressLine1,
    postal_code: input.postalCode,
    city: input.city,
    external_reference: input.externalReference,
    status: input.status,
  };
}

export async function insertCareOrganization(
  organizationId: string,
  input: CareOrganizationFormInput,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('care_organizations')
    .insert({ organization_id: organizationId, ...toRecord(input) })
    .select('id')
    .single();
  return data;
}

export async function updateCareOrganization(
  organizationId: string,
  careOrganizationId: string,
  input: CareOrganizationFormInput,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('care_organizations')
    .update(toRecord(input))
    .eq('organization_id', organizationId)
    .eq('id', careOrganizationId)
    .select('id')
    .maybeSingle();
  return data;
}

export async function softDeleteCareOrganization(
  organizationId: string,
  careOrganizationId: string,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('care_organizations')
    .update({ deleted_at: new Date().toISOString(), status: 'INACTIVE' })
    .eq('organization_id', organizationId)
    .eq('id', careOrganizationId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  return data;
}

export interface FundedClientRow {
  readonly clientId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly validFrom: string;
  readonly validTo: string | null;
}

/** De cliënten die deze opdrachtgever financiert, inclusief afgelopen periodes. */
export async function findFundedClients(
  careOrganizationId: string,
): Promise<FundedClientRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('client_care_organizations')
    .select(
      `valid_from, valid_to,
       client:clients!client_care_organizations_client_id_fkey
         (id, first_name, last_name, deleted_at)`,
    )
    .eq('care_organization_id', careOrganizationId)
    .order('valid_from', { ascending: false });

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
        validFrom: row.valid_from,
        validTo: row.valid_to,
      };
    })
    .filter((row): row is FundedClientRow => row !== null);
}

export interface ClientFunderRow {
  readonly careOrganizationId: string;
  readonly name: string;
  readonly validFrom: string;
  readonly validTo: string | null;
}

/** De opdrachtgevers van één cliënt. */
export async function findFundersForClient(clientId: string): Promise<ClientFunderRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('client_care_organizations')
    .select(
      `valid_from, valid_to,
       care_organization:care_organizations!client_care_organizations_care_organization_id_fkey
         (id, name, deleted_at)`,
    )
    .eq('client_id', clientId)
    .order('valid_from', { ascending: false });

  return (data ?? [])
    .map((row) => {
      const careOrg = row.care_organization as unknown as {
        id: string;
        name: string;
        deleted_at: string | null;
      } | null;
      if (!careOrg || careOrg.deleted_at) return null;
      return {
        careOrganizationId: careOrg.id,
        name: careOrg.name,
        validFrom: row.valid_from,
        validTo: row.valid_to,
      };
    })
    .filter((row): row is ClientFunderRow => row !== null);
}

export interface CareOrgLocationRow {
  readonly id: string;
  readonly name: string;
  readonly city: string | null;
  readonly status: string;
}

/** De vestigingen die aan deze opdrachtgever hangen. */
export async function findLocationsForCareOrganization(
  organizationId: string,
  careOrganizationId: string,
): Promise<CareOrgLocationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('locations')
    .select('id, name, city, status')
    .eq('organization_id', organizationId)
    .eq('care_organization_id', careOrganizationId)
    .is('deleted_at', null)
    .order('name');

  return data ?? [];
}
