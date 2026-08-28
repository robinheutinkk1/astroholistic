import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  escapeSearchTerm,
  toPage,
  type Page,
  type ResolvedListParams,
} from '@/lib/pagination';
import { type Tables } from '@/types/database';
import { type DriverFormInput, type DriverSort } from './schema';

export type DriverRow = Pick<
  Tables<'drivers'>,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'employee_number'
  | 'phone'
  | 'email'
  | 'status'
  | 'user_id'
>;

const LIST_COLUMNS =
  'id, first_name, last_name, employee_number, phone, email, status, user_id';

export async function findDrivers(
  organizationId: string,
  params: ResolvedListParams<DriverSort>,
): Promise<Page<DriverRow>> {
  const supabase = await createClient();
  let query = supabase
    .from('drivers')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (params.search) {
    const term = `%${escapeSearchTerm(params.search)}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},employee_number.ilike.${term}`,
    );
  }

  const { data, count } = await query
    .order(params.sort, { ascending: params.ascending })
    .order('id', { ascending: true })
    .range(params.from, params.to);

  return toPage(data ?? [], count ?? 0, params);
}

export async function findDriverById(organizationId: string, driverId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('drivers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', driverId)
    .is('deleted_at', null)
    .maybeSingle();
  return data;
}

export async function insertDriver(organizationId: string, input: DriverFormInput) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('drivers')
    .insert({
      organization_id: organizationId,
      first_name: input.firstName,
      last_name: input.lastName,
      employee_number: input.employeeNumber,
      phone: input.phone,
      email: input.email,
      status: input.status,
    })
    .select('id')
    .maybeSingle();
  return data;
}

export async function updateDriver(
  organizationId: string,
  driverId: string,
  input: DriverFormInput,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('drivers')
    .update(
      {
        first_name: input.firstName,
        last_name: input.lastName,
        employee_number: input.employeeNumber,
        phone: input.phone,
        email: input.email,
        status: input.status,
      },
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .eq('id', driverId);
  return !error && (count ?? 0) > 0;
}

export async function softDeleteDriver(
  organizationId: string,
  driverId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('drivers')
    .update(
      { deleted_at: new Date().toISOString(), status: 'INACTIVE' },
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .eq('id', driverId)
    .is('deleted_at', null);
  return !error && (count ?? 0) > 0;
}

/** Future rides still assigned to this driver — a blocker for removal. */
export async function countUpcomingRides(driverId: string): Promise<number> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from('rides')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', driverId)
    .gte('scheduled_date', today)
    .not('status', 'in', '(COMPLETED,CANCELLED,CLIENT_ABSENT)');
  return count ?? 0;
}
