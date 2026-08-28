import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { requireDriverContext, getTodayRides } from '@/features/driver/service';
import { getTodayTrips } from '@/features/driver/trips';
import { RIDE_STATUS_LABELS, type RideStatus } from '@/features/rides/status';
import { TRANSPORT_REQUIREMENT_LABELS } from '@/features/rides/schema';

export const metadata: Metadata = { title: 'Vandaag' };

const DONE: RideStatus[] = ['COMPLETED', 'CANCELLED', 'CLIENT_ABSENT'];

export default async function DriverTodayPage() {
  const context = await requireDriverContext();
  const [rides, trips] = await Promise.all([
    getTodayRides(context),
    getTodayTrips(context),
  ]);

  // Rides that belong to a group run are shown inside that run, not twice.
  const soloRides = rides.filter((ride) => ride.trip_id === null);

  if (soloRides.length === 0 && trips.length === 0) {
    return (
      <EmptyState
        title="Geen ritten vandaag"
        description="Er staat vandaag niets voor je ingepland."
      />
    );
  }

  const remaining = soloRides.filter((ride) => !DONE.includes(ride.status)).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--tp-muted-foreground)]">
        {trips.length > 0
          ? `${trips.length} ${trips.length === 1 ? 'groepsrit' : 'groepsritten'}`
          : null}
        {trips.length > 0 && soloRides.length > 0 ? ' · ' : null}
        {soloRides.length > 0 ? `${remaining} van ${soloRides.length} nog te doen` : null}
      </p>

      {trips.map((trip) => (
        <Link
          key={trip.id}
          href={`/driver/groepsrit/${trip.id}` as never}
          className="flex items-center gap-3 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-4"
        >
          <span className="w-14 shrink-0 text-lg font-semibold tabular-nums">
            {trip.plannedStartTime.slice(0, 5)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{trip.name ?? 'Groepsrit'}</span>
            <span className="mt-0.5 flex items-center gap-1 text-sm text-[var(--tp-muted-foreground)]">
              <Users className="size-4" aria-hidden="true" />
              {trip.passengerCount} {trip.passengerCount === 1 ? 'cliënt' : 'cliënten'} ·{' '}
              {trip.stops.length} stops
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 opacity-40" aria-hidden="true" />
        </Link>
      ))}

      {soloRides.map((ride) => {
        const done = DONE.includes(ride.status);
        return (
          <Link
            key={ride.id}
            href={`/driver/rit/${ride.id}` as never}
            className={`flex items-center gap-3 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-4 ${
              done ? 'opacity-60' : ''
            }`}
          >
            <span className="w-14 shrink-0 text-lg font-semibold tabular-nums">
              {ride.scheduled_pickup_time.slice(0, 5)}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {ride.client
                  ? `${ride.client.first_name} ${ride.client.last_name}`
                  : 'Onbekend'}
              </span>
              <span className="block truncate text-sm text-[var(--tp-muted-foreground)]">
                {ride.pickup?.city ?? ride.pickup?.name} → {ride.destination?.name}
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                <Badge variant={done ? 'neutral' : 'info'}>
                  {RIDE_STATUS_LABELS[ride.status]}
                </Badge>
                {ride.transport_requirements.map((requirement) => (
                  <Badge key={requirement} variant="outline">
                    {TRANSPORT_REQUIREMENT_LABELS[
                      requirement as keyof typeof TRANSPORT_REQUIREMENT_LABELS
                    ] ?? requirement}
                  </Badge>
                ))}
              </span>
            </span>

            <ChevronRight className="size-5 shrink-0 opacity-40" aria-hidden="true" />
          </Link>
        );
      })}
    </div>
  );
}
