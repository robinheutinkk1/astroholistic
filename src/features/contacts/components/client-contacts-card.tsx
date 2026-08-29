'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/states';
import { FormStatus } from '@/features/auth/components/form-status';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { linkContactAction, unlinkContactAction } from '../actions';
import type { ContactLinkRow } from '../service';

export interface SelectableContact {
  readonly id: string;
  readonly name: string;
}

function PendingButton({
  label,
  variant,
}: {
  label: string;
  variant?: 'outline' | 'danger';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} variant={variant ?? 'primary'}>
      {label}
    </Button>
  );
}

/** De drie afspraken, in de volgorde waarin ze zwaarder worden. */
const CAPABILITIES = [
  {
    name: 'canViewRides',
    label: 'Mag ritten inzien',
    hint: 'Ziet in het portaal de ritten van deze cliënt.',
  },
  {
    name: 'canReportAbsence',
    label: 'Mag afwezigheid melden',
    hint: 'Kan doorgeven dat de cliënt vandaag niet mee hoeft.',
  },
  {
    name: 'canRequestChanges',
    label: 'Mag wijzigingen aanvragen',
    hint: 'Kan een verzoek indienen; de planner beslist.',
  },
] as const;

export function ClientContactsCard({
  clientId,
  links,
  selectable,
  canManage,
}: {
  clientId: string;
  links: readonly ContactLinkRow[];
  /** Contactpersonen van deze organisatie die nog niet gekoppeld zijn. */
  selectable: readonly SelectableContact[];
  canManage: boolean;
}) {
  const [linkState, linkAction] = useActionState<FormState, FormData>(
    linkContactAction,
    IDLE,
  );
  const [unlinkState, unlinkAction] = useActionState<FormState, FormData>(
    unlinkContactAction,
    IDLE,
  );
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <FormStatus state={linkState} />
      <FormStatus state={unlinkState} />

      {links.length === 0 ? (
        <EmptyState
          title="Nog geen contactpersonen"
          description="Koppel een ouder, mentor of begeleider zodat die de ritten kan volgen."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {links.map((link) => (
            <li
              key={link.contactId}
              className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/contactpersonen/${link.contactId}` as never}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {link.firstName} {link.lastName}
                  </Link>
                  <p className="text-xs text-[var(--tp-muted-foreground)]">
                    {link.relationship ?? 'Geen relatie ingevuld'}
                    {link.phone ? ` · ${link.phone}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {link.isPrimary ? <Badge variant="info">Eerste contact</Badge> : null}
                  {link.userId ? <Badge variant="success">Portaal</Badge> : null}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {link.canViewRides ? <Badge variant="neutral">Ziet ritten</Badge> : null}
                {link.canReportAbsence ? (
                  <Badge variant="neutral">Meldt afwezig</Badge>
                ) : null}
                {link.canRequestChanges ? (
                  <Badge variant="neutral">Vraagt wijzigingen aan</Badge>
                ) : null}
                {!link.canViewRides &&
                !link.canReportAbsence &&
                !link.canRequestChanges ? (
                  <span className="text-xs text-[var(--tp-muted-foreground)]">
                    Ziet niets in het portaal
                  </span>
                ) : null}
              </div>

              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing(editing === link.contactId ? null : link.contactId)
                    }
                    aria-expanded={editing === link.contactId}
                  >
                    {editing === link.contactId ? 'Sluiten' : 'Afspraken wijzigen'}
                  </Button>
                  <form action={unlinkAction}>
                    <input type="hidden" name="clientId" value={clientId} />
                    <input type="hidden" name="contactId" value={link.contactId} />
                    <PendingButton label="Loskoppelen" variant="outline" />
                  </form>
                </div>
              ) : null}

              {canManage && editing === link.contactId ? (
                <form
                  action={linkAction}
                  className="mt-3 flex flex-col gap-3 border-t border-[var(--tp-border)] pt-3"
                >
                  <input type="hidden" name="clientId" value={clientId} />
                  <input type="hidden" name="contactId" value={link.contactId} />
                  <Field
                    label="Relatie tot de cliënt"
                    htmlFor={`relationship-${link.contactId}`}
                  >
                    <Input name="relationship" defaultValue={link.relationship ?? ''} />
                  </Field>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="text-sm font-medium">Wat mag deze persoon</legend>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="isPrimary"
                        defaultChecked={link.isPrimary}
                        className="mt-0.5"
                      />
                      <span>
                        Eerste contactpersoon
                        <span className="block text-xs text-[var(--tp-muted-foreground)]">
                          Degene die de planner als eerste belt.
                        </span>
                      </span>
                    </label>
                    {CAPABILITIES.map((capability) => (
                      <label
                        key={capability.name}
                        className="flex items-start gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name={capability.name}
                          defaultChecked={link[capability.name]}
                          className="mt-0.5"
                        />
                        <span>
                          {capability.label}
                          <span className="block text-xs text-[var(--tp-muted-foreground)]">
                            {capability.hint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <div>
                    <PendingButton label="Afspraken opslaan" />
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        selectable.length === 0 ? (
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            Er zijn geen contactpersonen meer om te koppelen.{' '}
            <Link href="/contactpersonen/nieuw" className="underline underline-offset-4">
              Maak er een aan
            </Link>
            .
          </p>
        ) : (
          <form
            action={linkAction}
            className="flex flex-col gap-3 border-t border-[var(--tp-border)] pt-4"
          >
            <input type="hidden" name="clientId" value={clientId} />
            <p className="text-sm font-medium">Contactpersoon koppelen</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Wie" htmlFor={`contactId-${clientId}`} required>
                <Select
                  name="contactId"
                  options={selectable.map((contact) => ({
                    value: contact.id,
                    label: contact.name,
                  }))}
                />
              </Field>
              <Field
                label="Relatie tot de cliënt"
                htmlFor={`new-relationship-${clientId}`}
              >
                <Input name="relationship" placeholder="moeder" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="canViewRides" defaultChecked />
              Mag de ritten van deze cliënt inzien
            </label>
            <div>
              <PendingButton label="Koppelen" />
            </div>
          </form>
        )
      ) : null}
    </div>
  );
}
