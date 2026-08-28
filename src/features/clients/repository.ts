import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  escapeSearchTerm,
  toPage,
  type Page,
  type ResolvedListParams,
} from '@/lib/pagination';
import { type Tables } from '@/types/database';
import { type ClientFormInput, type ClientSort } from './schema';

/**
 * Data access for clients. Knows PostgREST, knows no business rules
 * (docs/ARCHITECTURE.md §4). Permission checks live in service.ts; RLS enforces
 * them regardless.
 */
export type ClientRow = Pick<
  Tables<'clients'>,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'email'
  | 'address_line1'
  | 'postal_code'
  | 'city'
  | 'external_reference'
  | 'status'
  | 'created_at'
>;

const LIST_COLUMNS =
  'id, first_name, last_name, phone, email, address_line1, postal_code, city, external_reference, status, created_at';

export async function findClients(
  organizationId: string,
  params: ResolvedListParams<ClientSort>,
): Promise<Page<ClientRow>> {
  const supabase = await createClient();

  let query = supabase
    .from('clients')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (params.search) {
    const term = `%${escapeSearchTerm(params.search)}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},city.ilike.${term},external_reference.ilike.${term}`,
    );
  }

  const { data, count } = await query
    .order(params.sort, { ascending: params.ascending })
    // A stable tiebreaker: without it two clients with the same surname can
    // swap places between pages and one of them is never shown.
    .order('id', { ascending: true })
    .range(params.from, params.to);

  return toPage(data ?? [], count ?? 0, params);
}

export async function findClientById(
  organizationId: string,
  clientId: string,
): Promise<Tables<'clients'> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', clientId)
    .is('deleted_at', null)
    .maybeSingle();
  return data;
}

export async function insertClient(
  organizationId: string,
  input: ClientFormInput,
): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clients')
    .insert({
      organization_id: organizationId,
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      email: input.email,
      address_line1: input.addressLine1,
      postal_code: input.postalCode,
      city: input.city,
      external_reference: input.externalReference,
      status: input.status,
    })
    .select('id')
    .maybeSingle();
  return data;
}

export async function updateClient(
  organizationId: string,
  clientId: string,
  input: ClientFormInput,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('clients')
    .update(
      {
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
        email: input.email,
        address_line1: input.addressLine1,
        postal_code: input.postalCode,
        city: input.city,
        external_reference: input.externalReference,
        status: input.status,
      },
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .eq('id', clientId);
  return !error && (count ?? 0) > 0;
}

/**
 * Soft delete. Hard deletion would take the client's ride history and audit
 * trail with it; the GDPR erasure path anonymises instead
 * (docs/DATABASE.md §10).
 */
export async function softDeleteClient(
  organizationId: string,
  clientId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('clients')
    .update(
      { deleted_at: new Date().toISOString(), status: 'INACTIVE' },
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .eq('id', clientId)
    .is('deleted_at', null);
  return !error && (count ?? 0) > 0;
}

export async function countClientRides(clientId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('rides')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId);
  return count ?? 0;
}
