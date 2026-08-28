import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { todayInTimezone } from '@/lib/datetime/timezone';
import { type DriverContext, type PlaceSummary } from './service';
import { type RideStatus } from '@/features/rides/status';

/**
 * Group runs as the driver sees them.
 *
 * This is the shape decision D-17 exists for: one bus collecting several
 * clients at a day care is ONE stop with four people, not four separate rides.
 * The driver presses "I have arrived" once, then checks people off.
 */
export interface DriverPassenger {
  readonly rideId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly status: RideStatus;
  readonly transportRequirements: string[];
  readonly notes: string | null;
  readonly boardsHere: boolean;
  readonly alightsHere: boolean;
}

export interface DriverStop {
  readonly id: string;
  readonly sequence: number;
  readonly plannedArrivalTime: string | null;
  readonly arrivedAt: string | null;
  readonly location: PlaceSummary;
  readonly passengers: readonly DriverPassenger[];
}

export interface DriverTrip {
  readonly id: string;
  readonly name: string | null;
  readonly plannedStartTime: string;
  readonly status: string;
  readonly vehicle: { license_plate: string; seats: number } | null;
  readonly stops: readonly DriverStop[];
  readonly passengerCount: number;
}

export async function getTodayTrips(context: DriverContext): Promise<DriverTrip[]> {
  const supabase = await createClient();
  const today = todayInTimezone(context.timeZone);

  const { data: trips } = await supabase
    .from('trips')
    .select(
      `id, name, planned_start_time, status,
       vehicle:vehicles!trips_vehicle_id_fkey (license_plate, seats)`,
    )
    .eq('driver_id', context.driverId)
    .eq('scheduled_date', today)
    .neq('status', 'CANCELLED')
    .order('planned_start_at', { ascending: true });

  if (!trips || trips.length === 0) return [];
  const tripIds = trips.map((trip) => trip.id);

  // Two queries for the whole day rather than one per stop: a run with eight
  // stops must not cost eight round trips on a phone connection.
  const [stopsResult, ridesResult] = await Promise.all([
    supabase
      .from('trip_stops')
      .select(
        `id, trip_id, sequence, planned_arrival_time, arrived_at,
         location:locations!trip_stops_location_id_fkey
           (name, address_line1, postal_code, city, access_notes)`,
      )
      .in('trip_id', tripIds)
      .order('sequence', { ascending: true }),
    supabase
      .from('rides')
      .select(
        `id, trip_id, pickup_stop_id, dropoff_stop_id, status,
         transport_requirements, notes,
         client:clients!rides_client_id_fkey (first_name, last_name, phone)`,
      )
      .in('trip_id', tripIds),
  ]);

  const stops = (stopsResult.data ?? []) as unknown as {
    id: string;
    trip_id: string;
    sequence: number;
    planned_arrival_time: string | null;
    arrived_at: string | null;
    location: PlaceSummary;
  }[];

  const rides = (ridesResult.data ?? []) as unknown as {
    id: string;
    trip_id: string;
    pickup_stop_id: string | null;
    dropoff_stop_id: string | null;
    status: RideStatus;
    transport_requirements: string[];
    notes: string | null;
    client: { first_name: string; last_name: string; phone: string | null } | null;
  }[];

  return trips.map((trip) => {
    const tripStops = stops.filter((stop) => stop.trip_id === trip.id);
    const tripRides = rides.filter((ride) => ride.trip_id === trip.id);

    return {
      id: trip.id,
      name: trip.name,
      plannedStartTime: trip.planned_start_time,
      status: trip.status,
      vehicle: trip.vehicle,
      passengerCount: tripRides.length,
      stops: tripStops.map((stop) => ({
        id: stop.id,
        sequence: stop.sequence,
        plannedArrivalTime: stop.planned_arrival_time,
        arrivedAt: stop.arrived_at,
        location: stop.location,
        // A passenger appears at a stop if they board OR alight there. The
        // driver needs both lists at the door: who gets in, who gets out.
        passengers: tripRides
          .filter(
            (ride) => ride.pickup_stop_id === stop.id || ride.dropoff_stop_id === stop.id,
          )
          .map((ride) => ({
            rideId: ride.id,
            firstName: ride.client?.first_name ?? 'Onbekend',
            lastName: ride.client?.last_name ?? '',
            phone: ride.client?.phone ?? null,
            status: ride.status,
            transportRequirements: ride.transport_requirements,
            notes: ride.notes,
            boardsHere: ride.pickup_stop_id === stop.id,
            alightsHere: ride.dropoff_stop_id === stop.id,
          })),
      })),
    };
  });
}

export async function getDriverTrip(
  context: DriverContext,
  tripId: string,
): Promise<DriverTrip | null> {
  const trips = await getTodayTrips(context);
  return trips.find((trip) => trip.id === tripId) ?? null;
}

/**
 * Marks a whole stop as reached, in one action.
 *
 * The point of the trip layer: four passengers at a day care is one press of
 * "I have arrived", not four.
 */
export async function markStopArrived(
  context: DriverContext,
  stopId: string,
): Promise<boolean> {
  const supabase = await createClient();

  // RLS restricts trip_stops to the driver's own trips, so a stop belonging to
  // someone else's run simply matches nothing.
  const { error, count } = await supabase
    .from('trip_stops')
    .update({ arrived_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', stopId)
    .is('arrived_at', null);

  return !error && (count ?? 0) > 0;
}
