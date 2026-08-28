'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, MapPin, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { TRANSPORT_REQUIREMENT_LABELS } from '@/features/rides/schema';
import { driverActionAction, markStopArrivedAction } from '../actions';
import type { DriverStop } from '../trips';

function ArrivedButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="touch" loading={pending}>
      Ik ben aangekomen
    </Button>
  );
}

function PassengerButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" loading={pending}>
      {label}
    </Button>
  );
}

function PassengerRow({
  passenger,
  stopReached,
}: {
  passenger: DriverStop['passengers'][number];
  stopReached: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    driverActionAction,
    IDLE,
  );

  // Which single step this passenger is at, in this driver's words.
  const step = passenger.boardsHere
    ? passenger.status === 'DRIVER_ARRIVED'
      ? { action: 'checkin', label: 'Ingestapt' }
      : passenger.status === 'CLIENT_CHECKED_IN'
        ? { action: 'trip', label: 'Rijden' }
        : null
    : passenger.status === 'TRIP_STARTED'
      ? { action: 'delivered', label: 'Afgeleverd' }
      : passenger.status === 'ARRIVED'
        ? { action: 'complete', label: 'Afronden' }
        : null;

  const done = ['COMPLETED', 'CLIENT_ABSENT', 'CANCELLED'].includes(passenger.status);
  const checkedIn = [
    'CLIENT_CHECKED_IN',
    'TRIP_STARTED',
    'ARRIVED',
    'COMPLETED',
  ].includes(passenger.status);

  return (
    <li className="flex items-start gap-3 border-t border-[var(--tp-border)] py-3 first:border-t-0">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border ${
          checkedIn
            ? 'border-green-600 bg-green-600 text-white'
            : 'border-[var(--tp-border)]'
        }`}
      >
        {checkedIn ? <Check className="size-4" /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${done ? 'opacity-60' : ''}`}>
          {passenger.firstName} {passenger.lastName}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-1">
          {passenger.transportRequirements.map((requirement) => (
            <Badge key={requirement} variant="warning">
              {TRANSPORT_REQUIREMENT_LABELS[
                requirement as keyof typeof TRANSPORT_REQUIREMENT_LABELS
              ] ?? requirement}
            </Badge>
          ))}
          {passenger.status === 'CLIENT_ABSENT' ? (
            <Badge variant="neutral">Niet aanwezig</Badge>
          ) : null}
        </span>
        {passenger.notes ? (
          <span className="mt-1 block text-sm text-[var(--tp-muted-foreground)]">
            {passenger.notes}
          </span>
        ) : null}
        {state.status === 'error' ? (
          <span role="alert" className="mt-1 block text-sm text-[var(--tp-danger)]">
            {state.message}
          </span>
        ) : null}
      </span>

      {/* Nothing is tappable until the driver has reported arriving: checking
          someone in from the road would be a fiction in the audit trail. */}
      {step && stopReached ? (
        <form action={formAction}>
          <input type="hidden" name="rideId" value={passenger.rideId} />
          <input type="hidden" name="action" value={step.action} />
          <PassengerButton label={step.label} />
        </form>
      ) : null}
    </li>
  );
}

export function StopCard({
  stop,
  tripId,
  isNext,
}: {
  stop: DriverStop;
  tripId: string;
  isNext: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    markStopArrivedAction,
    IDLE,
  );
  const reached = stop.arrivedAt !== null;

  const query = [
    stop.location.address_line1,
    stop.location.postal_code,
    stop.location.city,
    stop.location.name,
  ]
    .filter(Boolean)
    .join(', ');

  const boarding = stop.passengers.filter((p) => p.boardsHere);
  const alighting = stop.passengers.filter((p) => p.alightsHere);

  return (
    <section
      className={`rounded-[var(--tp-radius)] border bg-[var(--tp-surface)] p-4 ${
        isNext && !reached
          ? 'border-[var(--tp-primary)] shadow-sm'
          : 'border-[var(--tp-border)]'
      } ${reached ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-[var(--tp-muted-foreground)] uppercase">
            Stop {stop.sequence}
            {stop.plannedArrivalTime ? ` · ${stop.plannedArrivalTime.slice(0, 5)}` : ''}
          </p>
          <h2 className="font-medium">{stop.location.name}</h2>
          {stop.location.city ? (
            <p className="text-sm text-[var(--tp-muted-foreground)]">
              {stop.location.address_line1}
              {stop.location.address_line1 ? ', ' : ''}
              {stop.location.city}
            </p>
          ) : null}
        </div>

        {reached ? (
          <Badge variant="success">Aangekomen</Badge>
        ) : (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Navigeren naar ${stop.location.name}`}
            className="flex min-h-11 min-w-11 items-center justify-center text-[var(--tp-primary)]"
          >
            <Navigation className="size-5" aria-hidden="true" />
          </a>
        )}
      </div>

      {stop.location.access_notes ? (
        <p className="mt-2 flex gap-2 rounded bg-[var(--tp-surface-muted)] px-2 py-1.5 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {stop.location.access_notes}
        </p>
      ) : null}

      {boarding.length > 0 ? (
        <>
          <p className="mt-3 text-sm font-medium">
            Instappen (
            {
              boarding.filter((p) =>
                ['CLIENT_CHECKED_IN', 'TRIP_STARTED', 'ARRIVED', 'COMPLETED'].includes(
                  p.status,
                ),
              ).length
            }
            /{boarding.length})
          </p>
          <ul>
            {boarding.map((passenger) => (
              <PassengerRow
                key={passenger.rideId}
                passenger={passenger}
                stopReached={reached}
              />
            ))}
          </ul>
        </>
      ) : null}

      {alighting.length > 0 ? (
        <>
          <p className="mt-3 text-sm font-medium">Uitstappen ({alighting.length})</p>
          <ul>
            {alighting.map((passenger) => (
              <PassengerRow
                key={passenger.rideId}
                passenger={passenger}
                stopReached={reached}
              />
            ))}
          </ul>
        </>
      ) : null}

      {/* One press for the whole stop — the reason the trip layer exists
          (decision D-17). Four passengers is not four "I have arrived" taps. */}
      {!reached ? (
        <form action={formAction} className="mt-4">
          <input type="hidden" name="stopId" value={stop.id} />
          <input type="hidden" name="tripId" value={tripId} />
          <ArrivedButton />
          {state.status === 'error' ? (
            <p role="alert" className="mt-2 text-sm text-[var(--tp-danger)]">
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
