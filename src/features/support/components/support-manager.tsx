'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormStatus } from '@/features/auth/components/form-status';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { grantSupportAction, revokeSupportAction } from '../actions';
import {
  SUPPORT_DURATION_LABELS,
  SUPPORT_DURATIONS,
  SUPPORT_SCOPE_DESCRIPTIONS,
  SUPPORT_SCOPE_LABELS,
  SUPPORT_SCOPES,
  type SupportScope,
} from '../schema';
import { type SupportGrantRow } from '../service';

export interface PlatformStaffOption {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

function SubmitButton({ label, variant }: { label: string; variant?: 'outline' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} {...(variant ? { variant } : {})}>
      {label}
    </Button>
  );
}

function grantState(grant: SupportGrantRow, now: number) {
  if (grant.revokedAt) return { label: 'Ingetrokken', variant: 'neutral' as const };
  if (Date.parse(grant.expiresAt) <= now)
    return { label: 'Verlopen', variant: 'neutral' as const };
  return { label: 'Actief', variant: 'warning' as const };
}

function GrantRow({ grant, now }: { grant: SupportGrantRow; now: number }) {
  const [state, action] = useActionState<FormState, FormData>(revokeSupportAction, IDLE);
  const status = grantState(grant, now);
  const isLive = status.label === 'Actief';

  return (
    <li className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{grant.grantedToName ?? grant.grantedToEmail}</span>
        <Badge variant={status.variant}>{status.label}</Badge>
        <Badge variant="outline">{SUPPORT_SCOPE_LABELS[grant.scope]}</Badge>
      </div>

      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="text-[var(--tp-muted-foreground)]">Reden</dt>
        <dd>{grant.reason}</dd>
        <dt className="text-[var(--tp-muted-foreground)]">Verleend door</dt>
        <dd>{grant.grantedByName ?? 'Onbekend'}</dd>
        <dt className="text-[var(--tp-muted-foreground)]">
          {isLive ? 'Loopt af' : 'Liep af'}
        </dt>
        <dd>{new Date(grant.expiresAt).toLocaleString('nl-NL')}</dd>
      </dl>

      {state.status !== 'idle' ? (
        <div className="mt-3">
          <FormStatus state={state} />
        </div>
      ) : null}

      {isLive ? (
        <form action={action} className="mt-3">
          <input type="hidden" name="id" value={grant.id} />
          <SubmitButton label="Nu intrekken" variant="outline" />
        </form>
      ) : null}
    </li>
  );
}

export function SupportManager({
  grants,
  staff,
  now,
}: {
  grants: readonly SupportGrantRow[];
  staff: readonly PlatformStaffOption[];
  /** Passed from the server so the first render matches and does not hydrate differently. */
  now: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(grantSupportAction, IDLE);
  const [scope, setScope] = useState<SupportScope>('OPERATIONAL');

  return (
    <div className="flex flex-col gap-6">
      {staff.length === 0 ? (
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Er zijn op dit moment geen platformmedewerkers om toegang aan te geven.
        </p>
      ) : (
        <form action={action} className="flex max-w-xl flex-col gap-4">
          <FormStatus state={state} />

          <Field
            label="Medewerker"
            htmlFor="grantedToUserId"
            error={state.fieldErrors?.['grantedToUserId']?.[0]}
          >
            <Select
              name="grantedToUserId"
              options={staff.map((person) => ({
                value: person.id,
                label: `${person.name} (${person.email})`,
              }))}
            />
          </Field>

          <Field
            label="Waarom is dit nodig?"
            htmlFor="reason"
            error={state.fieldErrors?.['reason']?.[0]}
            required
          >
            <Input
              name="reason"
              maxLength={200}
              placeholder="Ticket 1234, ritten van 3 maart"
            />
          </Field>

          <Field label="Hoeveel mag support zien?" htmlFor="scope">
            <Select
              name="scope"
              value={scope}
              onChange={(event) => setScope(event.target.value as SupportScope)}
              options={SUPPORT_SCOPES.map((value) => ({
                value,
                label: SUPPORT_SCOPE_LABELS[value],
              }))}
            />
          </Field>
          <p className="-mt-2 max-w-prose text-xs text-[var(--tp-muted-foreground)]">
            {SUPPORT_SCOPE_DESCRIPTIONS[scope]}
          </p>

          <Field label="Hoe lang?" htmlFor="durationHours" className="max-w-xs">
            <Select
              name="durationHours"
              defaultValue="2"
              options={SUPPORT_DURATIONS.map((hours) => ({
                value: String(hours),
                label: SUPPORT_DURATION_LABELS[hours],
              }))}
            />
          </Field>

          <div>
            <SubmitButton label="Toegang verlenen" />
          </div>
        </form>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold">Verleende toegang</h2>
        {grants.length === 0 ? (
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            Support heeft nooit toegang gehad tot deze organisatie.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {grants.map((grant) => (
              <GrantRow key={grant.id} grant={grant} now={now} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
