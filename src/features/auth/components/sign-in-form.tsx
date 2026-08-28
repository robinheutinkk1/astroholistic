'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { IDLE, signInAction, type FormState } from '../actions';
import { FormStatus } from './form-status';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="w-full">
      Inloggen
    </Button>
  );
}

// `| undefined` explicitly: with exactOptionalPropertyTypes an omitted prop
// and an explicitly-undefined one are different types, and the caller reads
// this straight from a search param.
export function SignInForm({ redirectTo }: { redirectTo?: string | undefined }) {
  const [state, formAction] = useActionState<FormState, FormData>(signInAction, IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormStatus state={state} />

      <Field
        label="E-mailadres"
        htmlFor="email"
        error={state.fieldErrors?.['email']?.[0]}
        required
      >
        <Input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="naam@bedrijf.nl"
        />
      </Field>

      <Field
        label="Wachtwoord"
        htmlFor="password"
        error={state.fieldErrors?.['password']?.[0]}
        required
      >
        <Input name="password" type="password" autoComplete="current-password" />
      </Field>

      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      <SubmitButton />

      <Link
        href="/forgot-password"
        className="text-center text-sm text-[var(--tp-muted-foreground)] underline underline-offset-4"
      >
        Wachtwoord vergeten?
      </Link>
    </form>
  );
}
