'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { ROLE_LABELS, type SystemRoleKey } from '@/features/rbac/permissions';
import { FormStatus } from '@/features/auth/components/form-status';
import { inviteMemberAction } from '../actions';
import type { AssignableRole } from '../service';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Uitnodiging versturen
    </Button>
  );
}

export function InviteMemberForm({ roles }: { roles: readonly AssignableRole[] }) {
  const [state, action] = useActionState<FormState, FormData>(inviteMemberAction, IDLE);

  if (roles.length === 0) {
    return (
      <p className="text-sm text-[var(--tp-muted-foreground)]">
        Je kunt niemand uitnodigen zolang je zelf geen rol mag toekennen. Vraag de
        eigenaar van deze organisatie om die rechten.
      </p>
    );
  }

  return (
    // React leegt een ongecontroleerd formulier zelf zodra de action klaar is,
    // zodat de volgende collega er direct in kan. De melding blijft wel staan:
    // die is het bewijs dat de uitnodiging de deur uit is.
    <form action={action} className="flex flex-col gap-4">
      <FormStatus state={state} />

      <Field
        label="E-mailadres"
        htmlFor="invite-email"
        required
        error={state.fieldErrors?.['email']?.[0]}
      >
        <Input
          name="email"
          type="email"
          autoComplete="off"
          required
          placeholder="collega@vervoerder.nl"
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Rollen</legend>
        <p className="text-xs text-[var(--tp-muted-foreground)]">
          Je ziet alleen rollen die niet méér mogen dan jij zelf.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="roleIds" value={role.id} />
              {ROLE_LABELS[role.key as SystemRoleKey] ?? role.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
