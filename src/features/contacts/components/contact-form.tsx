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
import { createContactAction, updateContactAction } from '../actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function ContactForm({ contact }: { contact?: Tables<'contacts'> }) {
  const isEdit = contact !== undefined;
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateContactAction : createContactAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormStatus state={state} />
      {isEdit ? <input type="hidden" name="id" value={contact.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Voornaam"
          htmlFor="firstName"
          error={state.fieldErrors?.['firstName']?.[0]}
          required
        >
          <Input name="firstName" defaultValue={contact?.first_name ?? ''} autoFocus />
        </Field>
        <Field
          label="Achternaam"
          htmlFor="lastName"
          error={state.fieldErrors?.['lastName']?.[0]}
          required
        >
          <Input name="lastName" defaultValue={contact?.last_name ?? ''} />
        </Field>
        <Field
          label="Telefoon"
          htmlFor="phone"
          error={state.fieldErrors?.['phone']?.[0]}
          hint="Het nummer dat de planner belt als een rit uitloopt."
        >
          <Input name="phone" type="tel" defaultValue={contact?.phone ?? ''} />
        </Field>
        <Field
          label="E-mailadres"
          htmlFor="email"
          error={state.fieldErrors?.['email']?.[0]}
          hint="Alleen voor contact. Portaaltoegang regel je apart, hieronder."
        >
          <Input name="email" type="email" defaultValue={contact?.email ?? ''} />
        </Field>
      </div>

      <Field label="Status" htmlFor="status" className="max-w-xs">
        <Select
          name="status"
          defaultValue={contact?.status ?? 'ACTIVE'}
          options={[
            { value: 'ACTIVE', label: 'Actief' },
            { value: 'INACTIVE', label: 'Inactief' },
          ]}
        />
      </Field>

      <div className="flex gap-2">
        <SubmitButton
          label={isEdit ? 'Wijzigingen opslaan' : 'Contactpersoon aanmaken'}
        />
        <Button variant="outline" asChild>
          <Link href="/contactpersonen">Annuleren</Link>
        </Button>
      </div>
    </form>
  );
}
