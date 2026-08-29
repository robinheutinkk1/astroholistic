'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormStatus } from '@/features/auth/components/form-status';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { type Tables } from '@/types/database';
import { createRideAction, updateRideAction } from '../actions';
import { TRANSPORT_REQUIREMENT_LABELS } from '../schema';

export interface PickerOption {
  readonly id: string;
  readonly label: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function RideForm({
  ride,
  clients,
  locations,
  drivers,
  vehicles,
  defaultDate,
}: {
  ride?: Tables<'rides'>;
  clients: readonly PickerOption[];
  locations: readonly PickerOption[];
  drivers: readonly PickerOption[];
  vehicles: readonly PickerOption[];
  defaultDate: string;
}) {
  const isEdit = ride !== undefined;
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateRideAction : createRideAction,
    IDLE,
  );

  const toOptions = (items: readonly PickerOption[], empty?: string) => [
    ...(empty ? [{ value: '', label: empty }] : []),
    ...items.map((item) => ({ value: item.id, label: item.label })),
  ];

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormStatus state={state} />
      {isEdit ? <input type="hidden" name="rideId" value={ride.id} /> : null}

      <Field
        label="Cliënt"
        htmlFor="clientId"
        error={state.fieldErrors?.['clientId']?.[0]}
        required
      >
        <Select
          name="clientId"
          defaultValue={ride?.client_id ?? ''}
          options={toOptions(clients, 'Kies een cliënt')}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Datum"
          htmlFor="scheduledDate"
          error={state.fieldErrors?.['scheduledDate']?.[0]}
          required
        >
          <Input
            name="scheduledDate"
            type="date"
            defaultValue={ride?.scheduled_date ?? defaultDate}
          />
        </Field>
        <Field
          label="Vertrektijd"
          htmlFor="scheduledPickupTime"
          error={state.fieldErrors?.['scheduledPickupTime']?.[0]}
          required
        >
          <Input
            name="scheduledPickupTime"
            type="time"
            defaultValue={ride?.scheduled_pickup_time?.slice(0, 5) ?? '08:00'}
          />
        </Field>

        <Field
          label="Ophalen bij"
          htmlFor="pickupLocationId"
          error={state.fieldErrors?.['pickupLocationId']?.[0]}
          required
        >
          <Select
            name="pickupLocationId"
            defaultValue={ride?.pickup_location_id ?? ''}
            options={toOptions(locations, 'Kies een locatie')}
          />
        </Field>
        <Field
          label="Afleveren bij"
          htmlFor="destinationLocationId"
          error={state.fieldErrors?.['destinationLocationId']?.[0]}
          required
        >
          <Select
            name="destinationLocationId"
            defaultValue={ride?.destination_location_id ?? ''}
            options={toOptions(locations, 'Kies een locatie')}
          />
        </Field>

        <Field label="Chauffeur" htmlFor="driverId">
          <Select
            name="driverId"
            defaultValue={ride?.driver_id ?? ''}
            options={toOptions(drivers, 'Nog niet toewijzen')}
          />
        </Field>
        <Field label="Voertuig" htmlFor="vehicleId">
          <Select
            name="vehicleId"
            defaultValue={ride?.vehicle_id ?? ''}
            options={toOptions(vehicles, 'Nog niet toewijzen')}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Vervoersbehoefte</legend>
        {/*
          On the ride, not on the client (decision D-03). This is what decides
          which vehicle can be used, so it belongs to the journey.
        */}
        <div className="flex flex-wrap gap-3">
          {Object.entries(TRANSPORT_REQUIREMENT_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="transportRequirements"
                value={value}
                defaultChecked={ride?.transport_requirements?.includes(value as never)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Notitie voor de chauffeur"
        htmlFor="notes"
        error={state.fieldErrors?.['notes']?.[0]}
      >
        <textarea
          name="notes"
          id="notes"
          rows={3}
          maxLength={500}
          defaultValue={ride?.notes ?? ''}
          className="w-full rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] px-3 py-2 text-sm"
        />
      </Field>

      <div className="flex gap-2">
        <SubmitButton label={isEdit ? 'Wijzigingen opslaan' : 'Rit aanmaken'} />
        <Button variant="outline" asChild>
          <Link href="/planning">Annuleren</Link>
        </Button>
      </div>
    </form>
  );
}
