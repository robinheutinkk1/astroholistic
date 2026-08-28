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
import { createDriverAction, updateDriverAction } from '../actions';
import { DRIVER_STATUS_LABELS } from '../schema';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function DriverForm({ driver }: { driver?: Tables<'drivers'> }) {
  const isEdit = driver !== undefined;
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateDriverAction : createDriverAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormStatus state={state} />
      {isEdit ? <input type="hidden" name="id" value={driver.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Voornaam"
          htmlFor="firstName"
          error={state.fieldErrors?.['firstName']?.[0]}
          required
        >
          <Input name="firstName" defaultValue={driver?.first_name ?? ''} autoFocus />
        </Field>
        <Field
          label="Achternaam"
          htmlFor="lastName"
          error={state.fieldErrors?.['lastName']?.[0]}
          required
        >
          <Input name="lastName" defaultValue={driver?.last_name ?? ''} />
        </Field>
        <Field label="Telefoon" htmlFor="phone" error={state.fieldErrors?.['phone']?.[0]}>
          <Input name="phone" type="tel" defaultValue={driver?.phone ?? ''} />
        </Field>
        <Field
          label="E-mailadres"
          htmlFor="email"
          error={state.fieldErrors?.['email']?.[0]}
        >
          <Input name="email" type="email" defaultValue={driver?.email ?? ''} />
        </Field>
        <Field
          label="Medewerkernummer"
          htmlFor="employeeNumber"
          error={state.fieldErrors?.['employeeNumber']?.[0]}
        >
          <Input name="employeeNumber" defaultValue={driver?.employee_number ?? ''} />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select
            name="status"
            defaultValue={driver?.status ?? 'ACTIVE'}
            options={Object.entries(DRIVER_STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Field>
      </div>

      <p className="rounded-[var(--tp-radius)] bg-[var(--tp-surface-muted)] px-3 py-2 text-xs text-[var(--tp-muted-foreground)]">
        Een chauffeur kan hier bestaan zonder account. Het uitnodigen voor de
        chauffeurs-app komt in een latere fase.
      </p>

      <div className="flex gap-2">
        <SubmitButton label={isEdit ? 'Wijzigingen opslaan' : 'Chauffeur aanmaken'} />
        <Button variant="outline" asChild>
          <Link href="/chauffeurs">Annuleren</Link>
        </Button>
      </div>
    </form>
  );
}
