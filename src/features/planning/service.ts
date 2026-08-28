import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { createClient } from '@/lib/supabase/server';
import {
  findConflicts,
  conflictsByRide,
  type Conflict,
} from '@/features/rides/conflicts';
import * as rideRepository from '@/features/rides/repository';
import { type RideListItem } from '@/features/rides/types';

/**
 * The day view a planner works in.
 *
 * One query per concern rather than one per ride: a day with 80 rides must not
 * become 80 round trips (masterprompt §49, "geen N+1 queries").
 */
export interface DayPlan {
  readonly date: string;
  readonly rides: readonly RideListItem[];
  readonly conflicts: ReadonlyMap<string, Conflict[]>;
  readonly drivers: readonly { id: string; name: string }[];
  readonly vehicles: readonly { id: string; label: string; seats: number }[];
  readonly counts: {
    readonly total: number;
    readonly unassigned: number;
    readonly cancelled: number;
  };
}

export async function getDayPlan(organizationId: string, date: string): Promise<DayPlan> {
  await requirePermission(organizationId, 'planning.view');
  const supabase = await createClient();

  const [rides, driversResult, vehiclesResult] = await Promise.all([
    rideRepository.findRidesForDate(organizationId, date),
    supabase
      .from('drivers')
      .select('id, first_name, last_name')
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .order('last_name'),
    supabase
      .from('vehicles')
      .select('id, license_plate, make, model, seats')
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .order('license_plate'),
  ]);

  const active = rides.filter(
    (ride) => ride.status !== 'CANCELLED' && ride.status !== 'CLIENT_ABSENT',
  );

  const conflicts = conflictsByRide(
    findConflicts(
      active.map((ride) => ({
        rideId: ride.id,
        pickupAt: ride.scheduled_pickup_at,
        driverId: ride.driver_id,
        vehicleId: ride.vehicle_id,
      })),
    ),
  );

  return {
    date,
    rides,
    conflicts,
    drivers: (driversResult.data ?? []).map((d) => ({
      id: d.id,
      name: `${d.first_name} ${d.last_name}`,
    })),
    vehicles: (vehiclesResult.data ?? []).map((v) => ({
      id: v.id,
      label: [v.license_plate, v.make, v.model].filter(Boolean).join(' · '),
      seats: v.seats,
    })),
    counts: {
      total: rides.length,
      unassigned: active.filter((ride) => ride.driver_id === null).length,
      cancelled: rides.filter((ride) => ride.status === 'CANCELLED').length,
    },
  };
}
