'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { IDLE, updateProfileAction, type FormState } from '../actions';
import { FormStatus } from './form-status';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Opslaan
    </Button>
  );
}

export function ProfileForm({
  fullName,
  phone,
  email,
}: {
  fullName: string;
  phone: string;
  email: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateProfileAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <FormStatus state={state} />

      <Field
        label="Naam"
        htmlFor="fullName"
        error={state.fieldErrors?.['fullName']?.[0]}
        required
      >
        <Input name="fullName" defaultValue={fullName} autoComplete="name" />
      </Field>

      <Field label="Telefoon" htmlFor="phone" error={state.fieldErrors?.['phone']?.[0]}>
        <Input name="phone" type="tel" defaultValue={phone} autoComplete="tel" />
      </Field>

      <Field
        label="E-mailadres"
        htmlFor="email"
        hint="Neem contact op met je beheerder om je e-mailadres te wijzigen."
      >
        <Input name="email" defaultValue={email} disabled />
      </Field>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
