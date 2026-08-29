'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { resetPasswordAction } from '../actions';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { FormStatus } from './form-status';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="w-full">
      Wachtwoord opslaan
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    resetPasswordAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormStatus state={state} />

      <Field
        label="Nieuw wachtwoord"
        htmlFor="password"
        error={state.fieldErrors?.['password']?.[0]}
        required
      >
        <Input name="password" type="password" autoComplete="new-password" autoFocus />
      </Field>

      <Field
        label="Herhaal wachtwoord"
        htmlFor="passwordConfirmation"
        error={state.fieldErrors?.['passwordConfirmation']?.[0]}
        required
      >
        <Input name="passwordConfirmation" type="password" autoComplete="new-password" />
      </Field>

      <SubmitButton />
    </form>
  );
}
