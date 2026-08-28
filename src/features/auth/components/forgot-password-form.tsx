'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { forgotPasswordAction } from '../actions';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { FormStatus } from './form-status';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="w-full">
      Stuur herstellink
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    forgotPasswordAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormStatus state={state} />

      {state.status !== 'success' ? (
        <>
          <Field
            label="E-mailadres"
            htmlFor="email"
            error={state.fieldErrors?.['email']?.[0]}
            hint="We sturen een link waarmee je een nieuw wachtwoord kunt instellen."
            required
          >
            <Input name="email" type="email" autoComplete="email" autoFocus />
          </Field>
          <SubmitButton />
        </>
      ) : null}

      <Link
        href="/login"
        className="text-center text-sm text-[var(--tp-muted-foreground)] underline underline-offset-4"
      >
        Terug naar inloggen
      </Link>
    </form>
  );
}
