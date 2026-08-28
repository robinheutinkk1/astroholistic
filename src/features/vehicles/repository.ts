import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  escapeSearchTerm,
  toPage,
  type Page,
  type ResolvedListParams,
} from '@/lib/pagination';
import { type Tables } from '@/types/database';
import { type VehicleFormInput, type VehicleSort } from './schema';

export type VehicleRow = Pick<
  Tables<'vehicles'>,
  | 'id'
  | 'license_plate'
  | 'make'
  | 'model'
  | 'vehicle_type'
  | 'seats'
  | 'wheelchair_positions'
  | 'is_wheelchair_accessible'
  | 'status'
>;

const LIST_COLUMNS =
  'id, license_plate, make, model, vehicle_type, seats, wheelchair_positions, is_wheelchair_accessible, status';

export async function findVehicles(
  organizationId: string,
  params: ResolvedListParams<VehicleSort>,
): Promise<Page<VehicleRow>> {
  const supabase = await createClient();
  let query = supabase
    .from('vehicles')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (params.search) {
    const term = `%${escapeSearchTerm(params.search)}%`;
    query = query.or(
      `license_plate.ilike.${term},make.ilike.${term},model.ilike.${term}`,
    );
  }

  const { data, count } = await query
    .order(params.sort, { ascending: params.ascending })
    .order('id', { ascending: true })
    .range(params.from, params.to);

  return toPage(data ?? [], count ?? 0, params);
}

export async function findVehicleById(organizationId: string, vehicleId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('vehicles')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', vehicleId)
    .is('deleted_at', null)
    .maybeSingle();
  return data;
}

/**
 * `is_wheelchair_accessible` is derived, never entered separately: the database
 * has a check constraint tying it to wheelchair_positions, because a flag and a
 * count that disagree are how the wrong vehicle gets dispatched.
 */
function toRecord(input: VehicleFormInput) {
  return {
    license_plate: input.licensePlate,
    make: input.make,
    model: input.model,
    vehicle_type: input.vehicleType,
    seats: input.seats,
    wheelchair_positions: input.wheelchairPositions,
    is_wheelchair_accessible: input.wheelchairPositions > 0,
    status: input.status,
  };
}

export async function insertVehicle(organizationId: string, input: VehicleFormInput) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('vehicles')
    .insert({ organization_id: organizationId, ...toRecord(input) })
    .select('id')
    .maybeSingle();
  return data;
}

export async function updateVehicle(
  organizationId: string,
  vehicleId: string,
  input: VehicleFormInput,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('vehicles')
    .update(toRecord(input), { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('id', vehicleId);
  return !error && (count ?? 0) > 0;
}

export async function softDeleteVehicle(
  organizationId: string,
  vehicleId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('vehicles')
    .update(
      { deleted_at: new Date().toISOString(), status: 'INACTIVE' },
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .eq('id', vehicleId)
    .is('deleted_at', null);
  return !error && (count ?? 0) > 0;
}
