import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { StopCard } from '@/features/driver/components/stop-card';
import { requireDriverContext } from '@/features/driver/service';
import { getDriverTrip } from '@/features/driver/trips';

export const metadata: Metadata = { title: 'Groepsrit' };

export default async function DriverTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const context = await requireDriverContext();
  const { tripId } = await params;
  const trip = await getDriverTrip(context, tripId);
  if (!trip) notFound();

  // The first stop not yet reported is highlighted, so the driver's eye lands
  // on what to do next rather than on a wall of identical cards.
  const nextStop = trip.stops.find((stop) => stop.arrivedAt === null);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/driver"
        className="flex min-h-11 items-center gap-1 text-sm text-[var(--tp-muted-foreground)]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Terug
      </Link>

      <div>
        <p className="text-2xl font-semibold tabular-nums">
          {trip.plannedStartTime.slice(0, 5)}
        </p>
        <h1 className="text-xl font-semibold">{trip.name ?? 'Groepsrit'}</h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-[var(--tp-muted-foreground)]">
          <Users className="size-4" aria-hidden="true" />
          {trip.passengerCount} {trip.passengerCount === 1 ? 'cliënt' : 'cliënten'} ·{' '}
          {trip.stops.length} stops
          {trip.vehicle ? ` · ${trip.vehicle.license_plate}` : ''}
        </p>
      </div>

      {trip.stops.map((stop) => (
        <StopCard
          key={stop.id}
          stop={stop}
          tripId={trip.id}
          isNext={stop.id === nextStop?.id}
        />
      ))}
    </div>
  );
}
