'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormStatus } from '@/features/auth/components/form-status';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { updateRetentionAction } from '../actions';
import { type RetentionRow } from '../service';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      Bewaartermijn opslaan
    </Button>
  );
}

export function RetentionForm({ retention }: { retention: RetentionRow }) {
  const [state, action] = useActionState<FormState, FormData>(
    updateRetentionAction,
    IDLE,
  );

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <FormStatus state={state} />

      <Field
        label="Wissen na hoeveel maanden zonder rit?"
        htmlFor="inactiveClientMonths"
        hint="Gerekend vanaf de laatste rit, of vanaf het aanmaken als er nooit een rit was."
        error={state.fieldErrors?.['inactiveClientMonths']?.[0]}
      >
        <Input
          type="number"
          name="inactiveClientMonths"
          min={6}
          max={120}
          defaultValue={retention.inactiveClientMonths}
          className="max-w-32"
        />
      </Field>

      <label className="flex max-w-prose items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="autoAnonymizeEnabled"
          defaultChecked={retention.autoAnonymizeEnabled}
          className="mt-0.5"
        />
        <span>
          Wis persoonsgegevens automatisch zodra die termijn verstreken is. Staat dit uit,
          dan gebeurt er niets vanzelf en wist u handmatig per cliënt.
        </span>
      </label>

      <p className="max-w-prose text-xs text-[var(--tp-muted-foreground)]">
        Wissen betekent hier hetzelfde als bij een verzoek van een cliënt: naam en
        contactgegevens verdwijnen, de ritten blijven als vervoersadministratie bestaan.
        Het kan niet ongedaan worden gemaakt.
      </p>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
