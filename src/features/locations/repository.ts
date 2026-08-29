import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  escapeSearchTerm,
  toPage,
  type Page,
  type ResolvedListParams,
} from '@/lib/pagination';
import { type Tables } from '@/types/database';
import { type LocationFormInput, type LocationSort } from './schema';

export type LocationRow = Pick<
  Tables<'locations'>,
  | 'id'
  | 'name'
  | 'kind'
  | 'address_line1'
  | 'postal_code'
  | 'city'
  | 'status'
  | 'care_organization_id'
>;

const LIST_COLUMNS =
  'id, name, kind, address_line1, postal_code, city, status, care_organization_id';

export async function findLocations(
  organizationId: string,
  params: ResolvedListParams<LocationSort>,
): Promise<Page<LocationRow>> {
  const supabase = await createClient();
  let query = supabase
    .from('locations')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (params.search) {
    const term = `%${escapeSearchTerm(params.search)}%`;
    query = query.or(`name.ilike.${term},city.ilike.${term},address_line1.ilike.${term}`);
  }

  const { data, count } = await query
    .order(params.sort, { ascending: params.ascending })
    .order('id', { ascending: true })
    .range(params.from, params.to);

  return toPage(data ?? [], count ?? 0, params);
}

export async function findLocationById(organizationId: string, locationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('locations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', locationId)
    .is('deleted_at', null)
    .maybeSingle();
  return data;
}

function toRecord(input: LocationFormInput) {
  return {
    name: input.name,
    kind: input.kind,
    address_line1: input.addressLine1,
    postal_code: input.postalCode,
    city: input.city,
    access_notes: input.accessNotes,
    status: input.status,
    care_organization_id: input.careOrganizationId,
  };
}

export async function insertLocation(organizationId: string, input: LocationFormInput) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('locations')
    .insert({ organization_id: organizationId, ...toRecord(input) })
    .select('id')
    .maybeSingle();
  return data;
}

export async function updateLocation(
  organizationId: string,
  locationId: string,
  input: LocationFormInput,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('locations')
    .update(toRecord(input), { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('id', locationId);
  return !error && (count ?? 0) > 0;
}

export async function softDeleteLocation(
  organizationId: string,
  locationId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('locations')
    .update(
      { deleted_at: new Date().toISOString(), status: 'INACTIVE' },
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .eq('id', locationId)
    .is('deleted_at', null);
  return !error && (count ?? 0) > 0;
}
