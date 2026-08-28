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
import { createVehicleAction, updateVehicleAction } from '../actions';
import { VEHICLE_STATUS_LABELS } from '../schema';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function VehicleForm({ vehicle }: { vehicle?: Tables<'vehicles'> }) {
  const isEdit = vehicle !== undefined;
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateVehicleAction : createVehicleAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormStatus state={state} />
      {isEdit ? <input type="hidden" name="id" value={vehicle.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Kenteken"
          htmlFor="licensePlate"
          error={state.fieldErrors?.['licensePlate']?.[0]}
          required
        >
          <Input
            name="licensePlate"
            defaultValue={vehicle?.license_plate ?? ''}
            placeholder="12-ABC-3"
            autoFocus
            className="uppercase"
          />
        </Field>
        <Field
          label="Voertuigtype"
          htmlFor="vehicleType"
          error={state.fieldErrors?.['vehicleType']?.[0]}
        >
          <Input
            name="vehicleType"
            defaultValue={vehicle?.vehicle_type ?? ''}
            placeholder="Rolstoelbus"
          />
        </Field>
        <Field label="Merk" htmlFor="make" error={state.fieldErrors?.['make']?.[0]}>
          <Input name="make" defaultValue={vehicle?.make ?? ''} />
        </Field>
        <Field label="Model" htmlFor="model" error={state.fieldErrors?.['model']?.[0]}>
          <Input name="model" defaultValue={vehicle?.model ?? ''} />
        </Field>
        <Field
          label="Zitplaatsen"
          htmlFor="seats"
          error={state.fieldErrors?.['seats']?.[0]}
          hint="Exclusief de chauffeur."
          required
        >
          <Input
            name="seats"
            type="number"
            min={0}
            max={99}
            defaultValue={vehicle?.seats ?? 0}
          />
        </Field>
        <Field
          label="Rolstoelplaatsen"
          htmlFor="wheelchairPositions"
          error={state.fieldErrors?.['wheelchairPositions']?.[0]}
          hint="Nul betekent: dit voertuig is niet rolstoeltoegankelijk."
          required
        >
          <Input
            name="wheelchairPositions"
            type="number"
            min={0}
            max={20}
            defaultValue={vehicle?.wheelchair_positions ?? 0}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select
            name="status"
            defaultValue={vehicle?.status ?? 'ACTIVE'}
            options={Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Field>
      </div>

      <p className="rounded-[var(--tp-radius)] bg-[var(--tp-surface-muted)] px-3 py-2 text-xs text-[var(--tp-muted-foreground)]">
        Deze aantallen worden bij het plannen gebruikt om te controleren of een groepsrit
        past. Kloppen ze niet, dan staat er straks een te kleine bus voor de deur.
      </p>

      <div className="flex gap-2">
        <SubmitButton label={isEdit ? 'Wijzigingen opslaan' : 'Voertuig aanmaken'} />
        <Button variant="outline" asChild>
          <Link href="/voertuigen">Annuleren</Link>
        </Button>
      </div>
    </form>
  );
}
