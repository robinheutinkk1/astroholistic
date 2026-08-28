import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { createClient } from '@/lib/supabase/server';
import { todayInTimezone } from '@/lib/datetime/timezone';
import {
  attentionReason,
  bucketForStatus,
  type AttentionReason,
  type DispatchBucketKey,
} from './board';
import { type RideStatus } from '@/features/rides/status';

/**
 * The live dispatch board.
 *
 * Read fresh on every request and refetched when the ride stream signals a
 * change, rather than patched incrementally in the browser. The server already
 * does the joins; re-deriving them client-side is how two versions of the same
 * board drift apart.
 */
export interface DispatchRide {
  readonly id: string;
  readonly bucket: DispatchBucketKey;
  readonly status: RideStatus;
  readonly attention: AttentionReason;
  readonly scheduledPickupTime: string;
  readonly scheduledPickupAt: string;
  readonly clientName: string;
  readonly driverName: string | null;
  readonly vehiclePlate: string | null;
  readonly pickupName: string | null;
  readonly destinationName: string | null;
  readonly transportRequirements: string[];
  readonly lastEventAt: string | null;
}

export interface DispatchBoard {
  readonly date: string;
  readonly rides: readonly DispatchRide[];
  readonly needsAttention: readonly DispatchRide[];
  readonly counts: Readonly<Record<DispatchBucketKey, number>>;
}

export async function getDispatchBoard(
  organizationId: string,
  timeZone: string,
): Promise<DispatchBoard> {
  await requirePermission(organizationId, 'rides.dispatch');
  const supabase = await createClient();
  const date = todayInTimezone(timeZone);

  const { data } = await supabase
    .from('rides')
    .select(
      `id, status, scheduled_pickup_time, scheduled_pickup_at, transport_requirements,
       checked_in_at, started_at, arrived_at, completed_at, updated_at,
       client:clients!rides_client_id_fkey (first_name, last_name),
       driver:drivers!rides_driver_id_fkey (first_name, last_name),
       vehicle:vehicles!rides_vehicle_id_fkey (license_plate),
       pickup:locations!rides_pickup_location_id_fkey (name),
       destination:locations!rides_destination_location_id_fkey (name)`,
    )
    .eq('organization_id', organizationId)
    .eq('scheduled_date', date)
    .order('scheduled_pickup_at', { ascending: true })
    .order('id', { ascending: true });

  const now = new Date();

  const rides: DispatchRide[] = (data ?? []).map((row) => {
    const client = row.client as unknown as {
      first_name: string;
      last_name: string;
    } | null;
    const driver = row.driver;
    const vehicle = row.vehicle;
    const pickup = row.pickup as unknown as { name: string } | null;
    const destination = row.destination as unknown as { name: string } | null;

    const status = row.status;
    // `updated_at` is the closest thing to "when did this status last change".
    // Good enough to spot a driver stuck at a door; a dedicated column would be
    // more precise and is not worth an extra write on every update.
    const statusChangedAt = row.updated_at;

    return {
      id: row.id,
      status,
      bucket: bucketForStatus(status),
      attention: attentionReason(
        {
          id: row.id,
          status,
          scheduledPickupAt: row.scheduled_pickup_at,
          statusChangedAt,
        },
        now,
      ),
      scheduledPickupTime: row.scheduled_pickup_time,
      scheduledPickupAt: row.scheduled_pickup_at,
      clientName: client ? `${client.first_name} ${client.last_name}` : 'Onbekend',
      driverName: driver ? `${driver.first_name} ${driver.last_name}` : null,
      vehiclePlate: vehicle?.license_plate ?? null,
      pickupName: pickup?.name ?? null,
      destinationName: destination?.name ?? null,
      transportRequirements: row.transport_requirements,
      lastEventAt: statusChangedAt,
    };
  });

  const counts = rides.reduce<Record<string, number>>((acc, ride) => {
    acc[ride.bucket] = (acc[ride.bucket] ?? 0) + 1;
    return acc;
  }, {});

  return {
    date,
    rides,
    // Problems first, then whatever has been sitting longest.
    needsAttention: rides
      .filter((ride) => ride.attention !== null)
      .sort((a, b) => {
        if (a.attention === 'PROBLEM' && b.attention !== 'PROBLEM') return -1;
        if (b.attention === 'PROBLEM' && a.attention !== 'PROBLEM') return 1;
        return a.scheduledPickupAt.localeCompare(b.scheduledPickupAt);
      }),
    counts: counts as Record<DispatchBucketKey, number>,
  };
}
