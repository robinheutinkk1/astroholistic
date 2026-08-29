'use client';

import { useActionState } from 'react';
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
import { linkClientAction, unlinkClientAction } from '../actions';
import type { ClientFunderRow } from '../service';

export interface SelectableCareOrganization {
  readonly id: string;
  readonly name: string;
}

function PendingButton({ label, variant }: { label: string; variant?: 'outline' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} variant={variant ?? 'primary'}>
      {label}
    </Button>
  );
}

/** Loopt deze periode vandaag nog? */
function isCurrent(link: ClientFunderRow, today: string): boolean {
  return link.validFrom <= today && (link.validTo === null || link.validTo >= today);
}

export function ClientFundersCard({
  clientId,
  links,
  selectable,
  canManage,
  today,
}: {
  clientId: string;
  links: readonly ClientFunderRow[];
  selectable: readonly SelectableCareOrganization[];
  canManage: boolean;
  /** Vandaag als YYYY-MM-DD, door de server bepaald in de tijdzone van de organisatie. */
  today: string;
}) {
  const [linkState, linkAction] = useActionState<FormState, FormData>(
    linkClientAction,
    IDLE,
  );
  const [unlinkState, unlinkAction] = useActionState<FormState, FormData>(
    unlinkClientAction,
    IDLE,
  );

  return (
    <div className="flex flex-col gap-5">
      <FormStatus state={linkState} />
      <FormStatus state={unlinkState} />

      {links.length === 0 ? (
        <EmptyState
          title="Geen opdrachtgever"
          description="Koppel een gemeente of zorginstelling als die het vervoer van deze cliënt betaalt."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li
              key={`${link.careOrganizationId}-${link.validFrom}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--tp-radius)] border border-[var(--tp-border)] p-3"
            >
              <div>
                <Link
                  href={`/opdrachtgevers/${link.careOrganizationId}` as never}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {link.name}
                </Link>
                <p className="text-xs text-[var(--tp-muted-foreground)]">
                  Vanaf {link.validFrom}
                  {link.validTo ? ` tot en met ${link.validTo}` : ' — geen einddatum'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={isCurrent(link, today) ? 'success' : 'neutral'}>
                  {isCurrent(link, today) ? 'Loopt' : 'Afgelopen'}
                </Badge>
                {canManage ? (
                  <form action={unlinkAction}>
                    <input type="hidden" name="clientId" value={clientId} />
                    <input
                      type="hidden"
                      name="careOrganizationId"
                      value={link.careOrganizationId}
                    />
                    <input type="hidden" name="validFrom" value={link.validFrom} />
                    <PendingButton label="Verwijderen" variant="outline" />
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        selectable.length === 0 ? (
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            Er zijn nog geen opdrachtgevers.{' '}
            <Link href="/opdrachtgevers/nieuw" className="underline underline-offset-4">
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
            <p className="text-sm font-medium">Opdrachtgever koppelen</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Wie betaalt"
                htmlFor={`careOrganizationId-${clientId}`}
                required
              >
                <Select
                  name="careOrganizationId"
                  options={selectable.map((careOrg) => ({
                    value: careOrg.id,
                    label: careOrg.name,
                  }))}
                />
              </Field>
              <Field
                label="Vanaf"
                htmlFor={`validFrom-${clientId}`}
                required
                error={linkState.fieldErrors?.['validFrom']?.[0]}
              >
                <Input name="validFrom" type="date" defaultValue={today} />
              </Field>
              <Field
                label="Tot en met"
                htmlFor={`validTo-${clientId}`}
                hint="Leeg laten als de indicatie doorloopt."
                error={linkState.fieldErrors?.['validTo']?.[0]}
              >
                <Input name="validTo" type="date" />
              </Field>
            </div>
            <p className="text-xs text-[var(--tp-muted-foreground)]">
              Vanaf de begindatum ziet deze zorgorganisatie de ritten van deze cliënt — en
              na de einddatum niet meer.
            </p>
            <div>
              <PendingButton label="Koppelen" />
            </div>
          </form>
        )
      ) : null}
    </div>
  );
}
