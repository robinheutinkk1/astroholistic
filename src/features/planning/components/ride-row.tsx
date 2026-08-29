'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertTriangle, Accessibility } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Td, Tr } from '@/components/ui/data-table';
import { RideStatusBadge } from '@/features/rides/components/ride-status-badge';
import { assignRideAction } from '@/features/rides/actions';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { TRANSPORT_REQUIREMENT_LABELS } from '@/features/rides/schema';
import type { RideListItem } from '@/features/rides/types';
import type { Conflict } from '@/features/rides/conflicts';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" loading={pending}>
      Opslaan
    </Button>
  );
}

export function RideRow({
  ride,
  drivers,
  vehicles,
  conflicts,
  canAssign,
}: {
  ride: RideListItem;
  drivers: readonly { id: string; name: string }[];
  vehicles: readonly { id: string; label: string; seats: number }[];
  conflicts: readonly Conflict[];
  canAssign: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(assignRideAction, IDLE);
  const isClosed = ['COMPLETED', 'CANCELLED', 'CLIENT_ABSENT'].includes(ride.status);

  return (
    <Tr className={isClosed ? 'opacity-60' : undefined}>
      <Td className="font-medium whitespace-nowrap tabular-nums">
        {ride.scheduled_pickup_time.slice(0, 5)}
      </Td>

      <Td>
        <Link
          href={`/ritten/${ride.id}` as never}
          className="font-medium underline-offset-4 hover:underline"
        >
          {ride.client
            ? `${ride.client.first_name} ${ride.client.last_name}`
            : 'Onbekend'}
        </Link>
        {ride.transport_requirements.length > 0 ? (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-[var(--tp-muted-foreground)]">
            <Accessibility className="size-3" aria-hidden="true" />
            {ride.transport_requirements
              .map(
                (requirement) => TRANSPORT_REQUIREMENT_LABELS[requirement] ?? requirement,
              )
              .join(', ')}
          </span>
        ) : null}
      </Td>

      <Td className="text-[var(--tp-muted-foreground)]">
        <span className="block">{ride.pickup?.name ?? '-'}</span>
        <span className="block text-xs">→ {ride.destination?.name ?? '-'}</span>
      </Td>

      <Td>
        {canAssign && !isClosed ? (
          <form action={formAction} className="flex flex-wrap items-center gap-1.5">
            <input type="hidden" name="rideId" value={ride.id} />
            <Select
              name="driverId"
              aria-label="Chauffeur"
              defaultValue={ride.driver_id ?? ''}
              className="h-8 w-40 text-xs"
              options={[
                { value: '', label: 'Geen chauffeur' },
                ...drivers.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
            <Select
              name="vehicleId"
              aria-label="Voertuig"
              defaultValue={ride.vehicle_id ?? ''}
              className="h-8 w-40 text-xs"
              options={[
                { value: '', label: 'Geen voertuig' },
                ...vehicles.map((v) => ({ value: v.id, label: v.label })),
              ]}
            />
            <SaveButton />
            {state.status === 'error' ? (
              <span role="alert" className="text-xs text-[var(--tp-danger)]">
                {state.message}
              </span>
            ) : null}
          </form>
        ) : (
          <span className="text-sm text-[var(--tp-muted-foreground)]">
            {ride.driver
              ? `${ride.driver.first_name} ${ride.driver.last_name}`
              : 'Niet toegewezen'}
            {ride.vehicle ? ` · ${ride.vehicle.license_plate}` : ''}
          </span>
        )}

        {conflicts.length > 0 ? (
          // Advisory, not blocking: a planner sometimes knows better than the
          // model (see features/rides/conflicts.ts).
          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--tp-warning)]">
            <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
            {conflicts[0]?.kind === 'DRIVER' ? 'Chauffeur' : 'Voertuig'} staat{' '}
            {conflicts[0]?.minutesApart} min later op een andere rit
          </p>
        ) : null}
      </Td>

      <Td>
        <div className="flex flex-col items-start gap-1">
          <RideStatusBadge status={ride.status} />
          {ride.is_modified ? (
            <span className="text-xs text-[var(--tp-muted-foreground)]">
              Afwijkend van de vaste afspraak
            </span>
          ) : null}
        </div>
      </Td>
    </Tr>
  );
}
