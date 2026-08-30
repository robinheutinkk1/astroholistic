import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { createClient } from '@/lib/supabase/server';
import { type LocalDate } from '@/lib/datetime/timezone';
import { type RideStatus } from './presence';

/**
 * Wie er vandaag op een locatie wordt verwacht, en hoe ver ze zijn.
 *
 * Het bord telt aankomsten: ritten mét deze locatie als bestemming. De
 * terugritten naar huis staan er bewust niet op — de vraag van de begeleider
 * is "is Jan er al", niet "is Jan alweer weg", en die twee door elkaar maakt
 * van vier kleuren een puzzel.
 */
export interface PresenceRow {
  readonly rideId: string;
  readonly clientId: string | null;
  readonly clientName: string;
  readonly pickupTime: string | null;
  readonly status: RideStatus;
  readonly driverName: string | null;
}

export interface PresenceLocation {
  readonly id: string;
  readonly name: string;
  readonly city: string | null;
  readonly arrivalsToday: number;
}

/** De locaties waar vandaag iemand wordt verwacht, voor de keuzelijst. */
export async function listLocationsWithArrivals(
  organizationId: string,
  date: LocalDate,
): Promise<PresenceLocation[]> {
  await requirePermission(organizationId, 'rides.view');
  const supabase = await createClient();

  const { data } = await supabase
    .from('rides')
    .select(
      'destination_location_id, destination:locations!rides_destination_location_id_fkey (id, name, city)',
    )
    .eq('organization_id', organizationId)
    .eq('scheduled_date', date)
    .not('destination_location_id', 'is', null);

  const byId = new Map<string, PresenceLocation>();
  for (const row of data ?? []) {
    const destination = row.destination as unknown as {
      id: string;
      name: string;
      city: string | null;
    } | null;
    if (!destination) continue;
    const existing = byId.get(destination.id);
    byId.set(destination.id, {
      id: destination.id,
      name: destination.name,
      city: destination.city,
      arrivalsToday: (existing?.arrivalsToday ?? 0) + 1,
    });
  }

  return [...byId.values()].sort((a, b) => b.arrivalsToday - a.arrivalsToday);
}

export async function listArrivals(
  organizationId: string,
  locationId: string,
  date: LocalDate,
): Promise<PresenceRow[]> {
  await requirePermission(organizationId, 'rides.view');
  const supabase = await createClient();

  const { data } = await supabase
    .from('rides')
    .select(
      `id, status, scheduled_pickup_time, client_id,
       client:clients!rides_client_id_fkey (first_name, last_name),
       driver:drivers!rides_driver_id_fkey (first_name, last_name)`,
    )
    .eq('organization_id', organizationId)
    .eq('scheduled_date', date)
    .eq('destination_location_id', locationId)
    .order('scheduled_pickup_time', { ascending: true, nullsFirst: false });

  return (data ?? []).map((row) => {
    const client = row.client as unknown as {
      first_name: string;
      last_name: string;
    } | null;
    const driver = row.driver;
    return {
      rideId: row.id,
      clientId: row.client_id,
      // Een naam die RLS niet vrijgeeft is "Onbekend", nooit een lege regel:
      // de rij telt dan nog steeds mee in de aantallen.
      clientName: client ? `${client.first_name} ${client.last_name}` : 'Onbekend',
      pickupTime: row.scheduled_pickup_time,
      status: row.status,
      driverName: driver ? `${driver.first_name} ${driver.last_name}` : null,
    };
  });
}
