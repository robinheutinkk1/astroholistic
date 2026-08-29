'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { FormStatus } from '@/features/auth/components/form-status';
import { grantPortalAccessAction, revokePortalAccessAction } from '../actions';
import type { PortalSubjectKind } from '../grants';

function GrantButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Toegang geven
    </Button>
  );
}

function RevokeButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" loading={pending}>
      Toegang intrekken
    </Button>
  );
}

/**
 * Portaaltoegang voor één cliënt of contactpersoon.
 *
 * De kaart laat maar één ding tegelijk zien: óf er is toegang en die kun je
 * intrekken, óf er is geen toegang en je kunt hem geven. Een formulier dat
 * allebei toont nodigt uit tot het per ongeluk overschrijven van een koppeling
 * die al werkt.
 */
export function PortalAccessCard({
  kind,
  subjectId,
  currentEmail,
  canManage,
}: {
  kind: PortalSubjectKind;
  subjectId: string;
  /** Het adres dat nu toegang heeft, of null. */
  currentEmail: string | null;
  canManage: boolean;
}) {
  const [grantState, grantAction] = useActionState<FormState, FormData>(
    grantPortalAccessAction,
    IDLE,
  );
  const [revokeState, revokeAction] = useActionState<FormState, FormData>(
    revokePortalAccessAction,
    IDLE,
  );

  if (currentEmail) {
    return (
      <div className="flex flex-col gap-3">
        <FormStatus state={revokeState} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="success">Heeft toegang</Badge>
          <span className="text-[var(--tp-muted-foreground)]">{currentEmail}</span>
        </div>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Deze persoon ziet in het portaal alleen de eigen ritten — nooit die van anderen,
          en nooit de planning van de organisatie.
        </p>
        {canManage ? (
          <form action={revokeAction}>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="subjectId" value={subjectId} />
            <RevokeButton />
          </form>
        ) : null}
      </div>
    );
  }

  if (!canManage) {
    return (
      <p className="text-sm text-[var(--tp-muted-foreground)]">
        Er is nog geen portaaltoegang. Je hebt geen rechten om die te geven.
      </p>
    );
  }

  return (
    <form action={grantAction} className="flex flex-col gap-4">
      <FormStatus state={grantState} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="subjectId" value={subjectId} />

      <Field
        label="E-mailadres"
        htmlFor={`portal-email-${subjectId}`}
        required
        hint="Er gaat een mail naar dit adres met een link om zelf een wachtwoord te kiezen. Jij ziet dat wachtwoord nooit."
        error={grantState.fieldErrors?.['email']?.[0]}
      >
        <Input name="email" type="email" autoComplete="off" required />
      </Field>

      <div>
        <GrantButton />
      </div>
    </form>
  );
}
