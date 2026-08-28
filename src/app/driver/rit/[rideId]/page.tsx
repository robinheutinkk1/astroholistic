import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Navigation, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AbsenceDialog } from '@/features/driver/components/absence-dialog';
import { DriverActionButton } from '@/features/driver/components/action-button';
import { ProblemDialog } from '@/features/driver/components/problem-dialog';
import {
  getDriverRide,
  requireDriverContext,
  type PlaceSummary,
} from '@/features/driver/service';
import { nextDriverAction } from '@/features/driver/workflow';
import { RIDE_STATUS_LABELS } from '@/features/rides/status';
import { TRANSPORT_REQUIREMENT_LABELS } from '@/features/rides/schema';

export const metadata: Metadata = { title: 'Rit' };

function mapsUrl(place: PlaceSummary): string {
  const query = [place.address_line1, place.postal_code, place.city, place.name]
    .filter(Boolean)
    .join(', ');
  // A plain maps query rather than a provider SDK: it opens whatever navigation
  // app the driver already uses, on both iOS and Android.
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

function Place({ label, place }: { label: string; place: PlaceSummary | null }) {
  if (!place) return null;
  return (
    <div className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-4">
      <p className="text-xs tracking-wide text-[var(--tp-muted-foreground)] uppercase">
        {label}
      </p>
      <p className="mt-1 font-medium">{place.name}</p>
      {place.address_line1 ? (
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          {place.address_line1}
          {place.postal_code || place.city ? (
            <>
              <br />
              {[place.postal_code, place.city].filter(Boolean).join(' ')}
            </>
          ) : null}
        </p>
      ) : null}

      {place.access_notes ? (
        <p className="mt-2 rounded bg-[var(--tp-surface-muted)] px-2 py-1.5 text-sm">
          {place.access_notes}
        </p>
      ) : null}

      <a
        href={mapsUrl(place)}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--tp-primary)]"
      >
        <Navigation className="size-4" aria-hidden="true" />
        Navigeren
      </a>
    </div>
  );
}

export default async function DriverRidePage({
  params,
}: {
  params: Promise<{ rideId: string }>;
}) {
  const context = await requireDriverContext();
  const { rideId } = await params;
  const ride = await getDriverRide(context, rideId);
  if (!ride) notFound();

  const status = ride.status;
  const nextAction = nextDriverAction(status);
  const isFinished = ['COMPLETED', 'CANCELLED', 'CLIENT_ABSENT'].includes(status);

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
          {ride.scheduled_pickup_time.slice(0, 5)}
        </p>
        <h1 className="text-xl font-semibold">
          {ride.client
            ? `${ride.client.first_name} ${ride.client.last_name}`
            : 'Onbekend'}
        </h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant={isFinished ? 'neutral' : 'info'}>
            {RIDE_STATUS_LABELS[status]}
          </Badge>
          {ride.transport_requirements.map((requirement) => (
            <Badge key={requirement} variant="warning">
              {TRANSPORT_REQUIREMENT_LABELS[
                requirement as keyof typeof TRANSPORT_REQUIREMENT_LABELS
              ] ?? requirement}
            </Badge>
          ))}
        </div>
      </div>

      {ride.client?.phone ? (
        <a
          href={`tel:${ride.client.phone}`}
          className="flex min-h-12 items-center gap-2 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] px-4 text-base font-medium"
        >
          <Phone className="size-4" aria-hidden="true" />
          {ride.client.phone}
        </a>
      ) : null}

      {ride.notes ? (
        <p className="flex gap-2 rounded-[var(--tp-radius)] bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {ride.notes}
        </p>
      ) : null}

      <Place label="Ophalen bij" place={ride.pickup} />
      <Place label="Afleveren bij" place={ride.destination} />

      {/* One primary action at a time. Offering the whole workflow at once is
          how a driver taps the wrong button while holding a door open. */}
      {!isFinished ? (
        <div className="sticky bottom-4 flex flex-col gap-2">
          {nextAction ? (
            <DriverActionButton
              rideId={ride.id}
              action={nextAction.key}
              label={nextAction.action.label}
              captureGps={context.gpsEnabled}
            />
          ) : null}

          {status === 'DRIVER_ARRIVED' ? <AbsenceDialog rideId={ride.id} /> : null}
          <ProblemDialog rideId={ride.id} />
        </div>
      ) : (
        <p className="rounded-[var(--tp-radius)] bg-[var(--tp-surface)] p-4 text-center text-sm text-[var(--tp-muted-foreground)]">
          Deze rit is afgerond.
        </p>
      )}
    </div>
  );
}
