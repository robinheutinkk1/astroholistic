'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { IDLE, type FormState } from '@/features/auth/actions';
import { FormStatus } from '@/features/auth/components/form-status';
import { createClientAction, updateClientAction } from '../actions';
import { type Tables } from '@/types/database';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function ClientForm({ client }: { client?: Tables<'clients'> }) {
  const isEdit = client !== undefined;
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateClientAction : createClientAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormStatus state={state} />
      {isEdit ? <input type="hidden" name="clientId" value={client.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Voornaam"
          htmlFor="firstName"
          error={state.fieldErrors?.['firstName']?.[0]}
          required
        >
          <Input name="firstName" defaultValue={client?.first_name ?? ''} autoFocus />
        </Field>

        <Field
          label="Achternaam"
          htmlFor="lastName"
          error={state.fieldErrors?.['lastName']?.[0]}
          required
        >
          <Input name="lastName" defaultValue={client?.last_name ?? ''} />
        </Field>

        <Field label="Telefoon" htmlFor="phone" error={state.fieldErrors?.['phone']?.[0]}>
          <Input name="phone" type="tel" defaultValue={client?.phone ?? ''} />
        </Field>

        <Field
          label="E-mailadres"
          htmlFor="email"
          error={state.fieldErrors?.['email']?.[0]}
        >
          <Input name="email" type="email" defaultValue={client?.email ?? ''} />
        </Field>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Adres</legend>

        <Field
          label="Straat en huisnummer"
          htmlFor="addressLine1"
          error={state.fieldErrors?.['addressLine1']?.[0]}
          className="sm:col-span-2"
        >
          <Input name="addressLine1" defaultValue={client?.address_line1 ?? ''} />
        </Field>

        <Field
          label="Postcode"
          htmlFor="postalCode"
          error={state.fieldErrors?.['postalCode']?.[0]}
        >
          <Input name="postalCode" defaultValue={client?.postal_code ?? ''} />
        </Field>

        <Field label="Plaats" htmlFor="city" error={state.fieldErrors?.['city']?.[0]}>
          <Input name="city" defaultValue={client?.city ?? ''} />
        </Field>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Interne referentie"
          htmlFor="externalReference"
          hint="Bijvoorbeeld het cliëntnummer van de opdrachtgever."
          error={state.fieldErrors?.['externalReference']?.[0]}
        >
          <Input
            name="externalReference"
            defaultValue={client?.external_reference ?? ''}
          />
        </Field>

        <Field label="Status" htmlFor="status">
          <select
            name="status"
            id="status"
            defaultValue={client?.status ?? 'ACTIVE'}
            className="h-10 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] px-3 text-sm"
          >
            <option value="ACTIVE">Actief</option>
            <option value="INACTIVE">Inactief</option>
          </select>
        </Field>
      </div>

      {/*
        There is deliberately no field for wheelchair use or medical notes.
        Transport requirements belong to the ride, not the person (decision
        D-03). Adding one here needs that decision revisited first.
      */}
      <p className="rounded-[var(--tp-radius)] bg-[var(--tp-surface-muted)] px-3 py-2 text-xs text-[var(--tp-muted-foreground)]">
        Vervoersbehoeften zoals rolstoelvervoer leg je vast bij de rit, niet bij de
        cliënt. Zo blijft dit een vervoersadministratie en geen zorgdossier.
      </p>

      <div className="flex gap-2">
        <SubmitButton label={isEdit ? 'Wijzigingen opslaan' : 'Cliënt aanmaken'} />
        <Button variant="outline" asChild>
          <Link href="/clienten">Annuleren</Link>
        </Button>
      </div>
    </form>
  );
}
