import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { toPage, type Page, type ResolvedListParams } from '@/lib/pagination';
import { type Tables } from '@/types/database';
import { type RideFormInput, type RideSort } from './schema';
import { type RideListItem } from './types';

export type { RideListItem };

/**
 * Data access for rides. The nested selects here are the reason the generated
 * types carry foreign keys: `clients (first_name)` would otherwise be untyped.
 */
const LIST_SELECT = `
  id, scheduled_date, scheduled_pickup_time, scheduled_pickup_at, status,
  is_modified, transport_requirements, driver_id, vehicle_id, trip_id,
  client:clients!rides_client_id_fkey (first_name, last_name),
  pickup:locations!rides_pickup_location_id_fkey (name, city),
  destination:locations!rides_destination_location_id_fkey (name, city),
  driver:drivers!rides_driver_id_fkey (first_name, last_name),
  vehicle:vehicles!rides_vehicle_id_fkey (license_plate)
`;

export async function findRidesForDate(
  organizationId: string,
  date: string,
): Promise<RideListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('rides')
    .select(LIST_SELECT)
    .eq('organization_id', organizationId)
    .eq('scheduled_date', date)
    .order('scheduled_pickup_at', { ascending: true })
    .order('id', { ascending: true });
  return data ?? [];
}

export async function findRides(
  organizationId: string,
  params: ResolvedListParams<RideSort>,
  filters: {
    from?: string;
    to?: string;
    status?: Tables<'rides'>['status'];
    clientId?: string;
  },
): Promise<Page<RideListItem>> {
  const supabase = await createClient();
  let query = supabase
    .from('rides')
    .select(LIST_SELECT, { count: 'exact' })
    .eq('organization_id', organizationId);

  if (filters.from) query = query.gte('scheduled_date', filters.from);
  if (filters.to) query = query.lte('scheduled_date', filters.to);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.clientId) query = query.eq('client_id', filters.clientId);

  const { data, count } = await query
    .order(params.sort, { ascending: params.ascending })
    .order('id', { ascending: true })
    .range(params.from, params.to);

  return toPage((data ?? []) as unknown as RideListItem[], count ?? 0, params);
}

export async function findRideById(organizationId: string, rideId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('rides')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', rideId)
    .maybeSingle();
  return data;
}

export async function findRideEvents(rideId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ride_events')
    .select('id, event_type, occurred_at, source, actor_kind, actor_user_id, metadata')
    .eq('ride_id', rideId)
    .order('occurred_at', { ascending: true });
  return data ?? [];
}

export async function insertRide(
  organizationId: string,
  input: RideFormInput,
  scheduledPickupAt: string,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('rides')
    .insert({
      organization_id: organizationId,
      client_id: input.clientId,
      scheduled_date: input.scheduledDate,
      scheduled_pickup_time: input.scheduledPickupTime,
      scheduled_pickup_at: scheduledPickupAt,
      pickup_location_id: input.pickupLocationId,
      destination_location_id: input.destinationLocationId,
      driver_id: input.driverId,
      vehicle_id: input.vehicleId,
      status: input.driverId ? 'DRIVER_ASSIGNED' : 'SCHEDULED',
      source: 'MANUAL',
      transport_requirements: input.transportRequirements,
      notes: input.notes,
    })
    .select('id')
    .maybeSingle();
  return data;
}

/**
 * Editing a generated ride marks it as an exception, so the nightly generation
 * leaves it alone from then on (masterprompt §15).
 */
export async function updateRide(
  organizationId: string,
  rideId: string,
  input: RideFormInput,
  scheduledPickupAt: string,
  wasGenerated: boolean,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('rides')
    .update(
      {
        client_id: input.clientId,
        scheduled_date: input.scheduledDate,
        scheduled_pickup_time: input.scheduledPickupTime,
        scheduled_pickup_at: scheduledPickupAt,
        pickup_location_id: input.pickupLocationId,
        destination_location_id: input.destinationLocationId,
        driver_id: input.driverId,
        vehicle_id: input.vehicleId,
        transport_requirements: input.transportRequirements,
        notes: input.notes,
        ...(wasGenerated ? { is_modified: true } : {}),
      },
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .eq('id', rideId);
  return !error && (count ?? 0) > 0;
}

export async function assignRide(
  organizationId: string,
  rideId: string,
  driverId: string | null,
  vehicleId: string | null,
  nextStatus: Tables<'rides'>['status'] | null,
): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('rides')
    .update(
      {
        driver_id: driverId,
        vehicle_id: vehicleId,
        ...(nextStatus ? { status: nextStatus } : {}),
      },
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .eq('id', rideId);
  return !error && (count ?? 0) > 0;
}

export async function setRideStatus(
  organizationId: string,
  rideId: string,
  status: Tables<'rides'>['status'],
  extra: Partial<Tables<'rides'>> = {},
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('rides')
    .update({ status, ...extra }, { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('id', rideId);

  if (error) {
    // The database trigger enforces the state machine too; surface its message
    // rather than a generic failure.
    return { ok: false, message: error.message };
  }
  return { ok: (count ?? 0) > 0 };
}

export async function insertRideEvent(
  organizationId: string,
  rideId: string,
  eventType: Tables<'ride_events'>['event_type'],
  actorUserId: string,
  metadata: Record<string, string | number | boolean> = {},
): Promise<void> {
  const supabase = await createClient();
  await supabase.from('ride_events').insert({
    organization_id: organizationId,
    ride_id: rideId,
    event_type: eventType,
    actor_user_id: actorUserId,
    actor_kind: 'PLANNER',
    source: 'MANUAL',
    metadata,
  });
}
