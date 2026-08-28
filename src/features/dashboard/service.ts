import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/features/rbac/session';
import { type Enums } from '@/types/database';
import { todayInTimezone } from '@/lib/datetime/timezone';

/**
 * Today's figures for the dashboard (masterprompt §27).
 *
 * Counts are done with `head: true`, so PostgREST returns the count without the
 * rows. Fetching every ride to call `.length` in React would work today with
 * four demo rides and become the slowest query in the product at scale.
 */
export interface TodayCounts {
  readonly total: number;
  readonly completed: number;
  readonly enRoute: number;
  readonly waiting: number;
  readonly problems: number;
  readonly absent: number;
  readonly unassigned: number;
}

const EN_ROUTE_STATUSES: Enums<'ride_status'>[] = [
  'DRIVER_EN_ROUTE',
  'DRIVER_ARRIVED',
  'CLIENT_CHECKED_IN',
  'TRIP_STARTED',
];

const WAITING_STATUSES: Enums<'ride_status'>[] = ['SCHEDULED', 'DRIVER_ASSIGNED'];

export async function getTodayCounts(
  organizationId: string,
  timeZone: string,
): Promise<TodayCounts> {
  await requirePermission(organizationId, 'rides.view');
  const supabase = await createClient();
  const today = todayInTimezone(timeZone);

  const base = () =>
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('scheduled_date', today);

  const [total, completed, enRoute, waiting, problems, absent, unassigned] =
    await Promise.all([
      base(),
      base().eq('status', 'COMPLETED'),
      base().in('status', EN_ROUTE_STATUSES),
      base().in('status', WAITING_STATUSES),
      base().eq('status', 'PROBLEM'),
      base().eq('status', 'CLIENT_ABSENT'),
      base().is('driver_id', null).not('status', 'in', '(CANCELLED,COMPLETED)'),
    ]);

  return {
    total: total.count ?? 0,
    completed: completed.count ?? 0,
    enRoute: enRoute.count ?? 0,
    waiting: waiting.count ?? 0,
    problems: problems.count ?? 0,
    absent: absent.count ?? 0,
    unassigned: unassigned.count ?? 0,
  };
}

export interface FleetCounts {
  readonly clients: number;
  readonly drivers: number;
  readonly vehicles: number;
}

export async function getFleetCounts(organizationId: string): Promise<FleetCounts> {
  const supabase = await createClient();

  const [clients, drivers, vehicles] = await Promise.all([
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null),
    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null),
    supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null),
  ]);

  return {
    clients: clients.count ?? 0,
    drivers: drivers.count ?? 0,
    vehicles: vehicles.count ?? 0,
  };
}
