'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/states';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { FormStatus } from '@/features/auth/components/form-status';
import {
  grantPortalAccessAction,
  revokeCareOrgPortalUserAction,
} from '../actions';
import type { CareOrgPortalUser } from '../grants';

function PendingButton({ label, variant }: { label: string; variant?: 'outline' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} variant={variant ?? 'primary'}>
      {label}
    </Button>
  );
}

/**
 * De mensen van een zorgorganisatie die op het portaal kunnen.
 *
 * Meerdere, en dat is de bedoeling: bij een gemeente kijkt niet één ambtenaar
 * maar een team. Ieder krijgt een eigen account, zodat intrekken per persoon
 * kan en het auditspoor een naam heeft in plaats van een gedeeld inlogaccount.
 */
export function CareOrgPortalUsers({
  careOrganizationId,
  users,
  canManage,
}: {
  careOrganizationId: string;
  users: readonly CareOrgPortalUser[];
  canManage: boolean;
}) {
  const [grantState, grantAction] = useActionState<FormState, FormData>(
    grantPortalAccessAction,
    IDLE,
  );
  const [revokeState, revokeAction] = useActionState<FormState, FormData>(
    revokeCareOrgPortalUserAction,
    IDLE,
  );

  return (
    <div className="flex flex-col gap-5">
      <FormStatus state={grantState} />
      <FormStatus state={revokeState} />

      {users.length === 0 ? (
        <EmptyState
          title="Nog niemand met toegang"
          description="Nodig een contactpersoon uit om de ritten van de cliënten van deze opdrachtgever te volgen."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--tp-radius)] border border-[var(--tp-border)] p-3"
            >
              <div>
                <p className="font-medium">{user.fullName ?? user.email}</p>
                <p className="text-xs text-[var(--tp-muted-foreground)]">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={user.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {user.status === 'ACTIVE' ? 'Actief' : 'Uitgenodigd'}
                </Badge>
                {canManage ? (
                  <form action={revokeAction}>
                    <input
                      type="hidden"
                      name="careOrganizationId"
                      value={careOrganizationId}
                    />
                    <input type="hidden" name="membershipId" value={user.id} />
                    <PendingButton label="Intrekken" variant="outline" />
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form
          action={grantAction}
          className="flex flex-col gap-3 border-t border-[var(--tp-border)] pt-4"
        >
          <input type="hidden" name="kind" value="CARE_ORG" />
          <input type="hidden" name="subjectId" value={careOrganizationId} />
          <Field
            label="E-mailadres"
            htmlFor={`care-portal-email-${careOrganizationId}`}
            required
            hint="Deze persoon ziet alleen de cliënten die deze opdrachtgever financiert, en alleen binnen de looptijd."
            error={grantState.fieldErrors?.['email']?.[0]}
          >
            <Input name="email" type="email" autoComplete="off" required />
          </Field>
          <div>
            <PendingButton label="Uitnodigen" />
          </div>
        </form>
      ) : null}
    </div>
  );
}
