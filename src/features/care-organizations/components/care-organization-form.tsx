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
import {
  createCareOrganizationAction,
  updateCareOrganizationAction,
} from '../actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function CareOrganizationForm({
  careOrganization,
}: {
  careOrganization?: Tables<'care_organizations'>;
}) {
  const isEdit = careOrganization !== undefined;
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateCareOrganizationAction : createCareOrganizationAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormStatus state={state} />
      {isEdit ? <input type="hidden" name="id" value={careOrganization.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Naam"
          htmlFor="name"
          error={state.fieldErrors?.['name']?.[0]}
          required
          className="sm:col-span-2"
        >
          <Input
            name="name"
            defaultValue={careOrganization?.name ?? ''}
            placeholder="Gemeente Enschede"
            autoFocus
          />
        </Field>
        <Field
          label="E-mailadres"
          htmlFor="contactEmail"
          error={state.fieldErrors?.['contactEmail']?.[0]}
        >
          <Input
            name="contactEmail"
            type="email"
            defaultValue={careOrganization?.contact_email ?? ''}
          />
        </Field>
        <Field label="Telefoon" htmlFor="phone" error={state.fieldErrors?.['phone']?.[0]}>
          <Input name="phone" type="tel" defaultValue={careOrganization?.phone ?? ''} />
        </Field>
        <Field
          label="Straat en huisnummer"
          htmlFor="addressLine1"
          error={state.fieldErrors?.['addressLine1']?.[0]}
          className="sm:col-span-2"
        >
          <Input
            name="addressLine1"
            defaultValue={careOrganization?.address_line1 ?? ''}
          />
        </Field>
        <Field
          label="Postcode"
          htmlFor="postalCode"
          error={state.fieldErrors?.['postalCode']?.[0]}
        >
          <Input name="postalCode" defaultValue={careOrganization?.postal_code ?? ''} />
        </Field>
        <Field label="Plaats" htmlFor="city" error={state.fieldErrors?.['city']?.[0]}>
          <Input name="city" defaultValue={careOrganization?.city ?? ''} />
        </Field>
        <Field
          label="Eigen referentie"
          htmlFor="externalReference"
          hint="Contractnummer of debiteurnummer, zoals jij het kent."
          error={state.fieldErrors?.['externalReference']?.[0]}
        >
          <Input
            name="externalReference"
            defaultValue={careOrganization?.external_reference ?? ''}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select
            name="status"
            defaultValue={careOrganization?.status ?? 'ACTIVE'}
            options={[
              { value: 'ACTIVE', label: 'Actief' },
              { value: 'INACTIVE', label: 'Inactief' },
            ]}
          />
        </Field>
      </div>

      <div className="flex gap-2">
        <SubmitButton
          label={isEdit ? 'Wijzigingen opslaan' : 'Opdrachtgever aanmaken'}
        />
        <Button variant="outline" asChild>
          <Link href="/opdrachtgevers">Annuleren</Link>
        </Button>
      </div>
    </form>
  );
}
