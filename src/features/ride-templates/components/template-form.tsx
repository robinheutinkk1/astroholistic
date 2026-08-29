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
import { TRANSPORT_REQUIREMENT_LABELS } from '@/features/rides/schema';
import type { PickerOption } from '@/features/rides/components/ride-form';
import { type Tables } from '@/types/database';
import { createTemplateAction, updateTemplateAction } from '../actions';
import { TEMPLATE_STATUS_LABELS, WEEKDAY_OPTIONS } from '../schema';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function TemplateForm({
  template,
  clients,
  locations,
  drivers,
  vehicles,
  futureRides,
}: {
  template?: Tables<'ride_templates'>;
  clients: readonly PickerOption[];
  locations: readonly PickerOption[];
  drivers: readonly PickerOption[];
  vehicles: readonly PickerOption[];
  futureRides?: { total: number; modified: number };
}) {
  const isEdit = template !== undefined;
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateTemplateAction : createTemplateAction,
    IDLE,
  );

  const toOptions = (items: readonly PickerOption[], empty?: string) => [
    ...(empty ? [{ value: '', label: empty }] : []),
    ...items.map((item) => ({ value: item.id, label: item.label })),
  ];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormStatus state={state} />
      {isEdit ? <input type="hidden" name="id" value={template.id} /> : null}

      {/*
        Generation is additive: rides that already exist keep their old details
        (decision D-06). Saying so before saving is the difference between a
        planner understanding the tool and being surprised by it.
      */}
      {isEdit && futureRides && futureRides.total > 0 ? (
        <p className="rounded-[var(--tp-radius)] bg-[var(--tp-surface-muted)] px-3 py-2 text-sm">
          Er staan al <strong>{futureRides.total}</strong> toekomstige{' '}
          {futureRides.total === 1 ? 'rit' : 'ritten'} ingepland uit deze afspraak. Die
          houden hun huidige tijd en chauffeur; een wijziging hier geldt voor nieuwe
          ritten.
          {futureRides.modified > 0 ? (
            <>
              {' '}
              {futureRides.modified} daarvan {futureRides.modified === 1 ? 'is' : 'zijn'}{' '}
              handmatig aangepast.
            </>
          ) : null}
        </p>
      ) : null}

      <Field
        label="Cliënt"
        htmlFor="clientId"
        error={state.fieldErrors?.['clientId']?.[0]}
        required
      >
        <Select
          name="clientId"
          defaultValue={template?.client_id ?? ''}
          options={toOptions(clients, 'Kies een cliënt')}
        />
      </Field>

      <Field label="Omschrijving" htmlFor="name" error={state.fieldErrors?.['name']?.[0]}>
        <Input name="name" defaultValue={template?.name ?? ''} />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Op welke dagen?
          <span className="ml-0.5 text-[var(--tp-danger)]" aria-hidden="true">
            *
          </span>
        </legend>
        <div className="flex flex-wrap gap-3">
          {WEEKDAY_OPTIONS.map((day) => (
            <label key={day.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="daysOfWeek"
                value={day.value}
                defaultChecked={
                  template?.days_of_week?.includes(day.value) ?? day.value <= 5
                }
              />
              {day.label}
            </label>
          ))}
        </div>
        {state.fieldErrors?.['daysOfWeek']?.[0] ? (
          <p role="alert" className="mt-1 text-xs text-[var(--tp-danger)]">
            {state.fieldErrors['daysOfWeek'][0]}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Vertrektijd"
          htmlFor="departureTime"
          error={state.fieldErrors?.['departureTime']?.[0]}
          required
        >
          <Input
            name="departureTime"
            type="time"
            defaultValue={template?.departure_time?.slice(0, 5) ?? '08:00'}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select
            name="status"
            defaultValue={template?.status ?? 'ACTIVE'}
            options={Object.entries(TEMPLATE_STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
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
            defaultValue={template?.pickup_location_id ?? ''}
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
            defaultValue={template?.destination_location_id ?? ''}
            options={toOptions(locations, 'Kies een locatie')}
          />
        </Field>

        <Field
          label="Vanaf"
          htmlFor="startsOn"
          error={state.fieldErrors?.['startsOn']?.[0]}
          required
        >
          <Input
            name="startsOn"
            type="date"
            defaultValue={template?.starts_on ?? today}
          />
        </Field>
        <Field
          label="Tot en met"
          htmlFor="endsOn"
          error={state.fieldErrors?.['endsOn']?.[0]}
        >
          <Input name="endsOn" type="date" defaultValue={template?.ends_on ?? ''} />
        </Field>

        <Field label="Vaste chauffeur" htmlFor="defaultDriverId">
          <Select
            name="defaultDriverId"
            defaultValue={template?.default_driver_id ?? ''}
            options={toOptions(drivers, 'Geen vaste chauffeur')}
          />
        </Field>
        <Field label="Vast voertuig" htmlFor="defaultVehicleId">
          <Select
            name="defaultVehicleId"
            defaultValue={template?.default_vehicle_id ?? ''}
            options={toOptions(vehicles, 'Geen vast voertuig')}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Vervoersbehoefte</legend>
        {/*
          Decision D-03a: inherited by every generated ride, so a planner does
          not tick "wheelchair" five hundred times a year.
        */}
        <p className="mb-2 text-xs text-[var(--tp-muted-foreground)]">
          Wordt automatisch overgenomen op elke rit die hieruit ontstaat.
        </p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(TRANSPORT_REQUIREMENT_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="transportRequirements"
                value={value}
                defaultChecked={template?.transport_requirements?.includes(
                  value as never,
                )}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <SubmitButton
          label={isEdit ? 'Wijzigingen opslaan' : 'Terugkerende rit aanmaken'}
        />
        <Button variant="outline" asChild>
          <Link href="/terugkerend">Annuleren</Link>
        </Button>
      </div>
    </form>
  );
}
