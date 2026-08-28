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
import { createLocationAction, updateLocationAction } from '../actions';
import { LOCATION_KIND_LABELS, LOCATION_KINDS } from '../schema';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function LocationForm({ location }: { location?: Tables<'locations'> }) {
  const isEdit = location !== undefined;
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateLocationAction : createLocationAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormStatus state={state} />
      {isEdit ? <input type="hidden" name="id" value={location.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Naam"
          htmlFor="name"
          error={state.fieldErrors?.['name']?.[0]}
          required
        >
          <Input
            name="name"
            defaultValue={location?.name ?? ''}
            placeholder="Dagbesteding De Es"
            autoFocus
          />
        </Field>
        <Field label="Soort locatie" htmlFor="kind">
          <Select
            name="kind"
            defaultValue={location?.kind ?? 'OTHER'}
            options={LOCATION_KINDS.map((kind) => ({
              value: kind,
              label: LOCATION_KIND_LABELS[kind],
            }))}
          />
        </Field>
        <Field
          label="Straat en huisnummer"
          htmlFor="addressLine1"
          error={state.fieldErrors?.['addressLine1']?.[0]}
          className="sm:col-span-2"
        >
          <Input name="addressLine1" defaultValue={location?.address_line1 ?? ''} />
        </Field>
        <Field
          label="Postcode"
          htmlFor="postalCode"
          error={state.fieldErrors?.['postalCode']?.[0]}
        >
          <Input name="postalCode" defaultValue={location?.postal_code ?? ''} />
        </Field>
        <Field label="Plaats" htmlFor="city" error={state.fieldErrors?.['city']?.[0]}>
          <Input name="city" defaultValue={location?.city ?? ''} />
        </Field>
      </div>

      <Field
        label="Toelichting voor de chauffeur"
        htmlFor="accessNotes"
        hint="Praktische instructies, bijvoorbeeld: aanbellen bij de achteringang. Geen persoonlijke of medische informatie."
        error={state.fieldErrors?.['accessNotes']?.[0]}
      >
        <textarea
          name="accessNotes"
          id="accessNotes"
          rows={3}
          maxLength={300}
          defaultValue={location?.access_notes ?? ''}
          className="w-full rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Status" htmlFor="status" className="max-w-xs">
        <Select
          name="status"
          defaultValue={location?.status ?? 'ACTIVE'}
          options={[
            { value: 'ACTIVE', label: 'Actief' },
            { value: 'INACTIVE', label: 'Inactief' },
          ]}
        />
      </Field>

      <div className="flex gap-2">
        <SubmitButton label={isEdit ? 'Wijzigingen opslaan' : 'Locatie aanmaken'} />
        <Button variant="outline" asChild>
          <Link href="/locaties">Annuleren</Link>
        </Button>
      </div>
    </form>
  );
}
