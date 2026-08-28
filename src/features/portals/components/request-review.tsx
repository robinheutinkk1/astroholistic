'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { FormStatus } from '@/features/auth/components/form-status';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { reviewRequestAction } from '../actions';
import type { ReviewableRequest } from '../review';

const KIND_LABELS: Record<string, string> = {
  ABSENCE: 'Afmelding',
  TIME_CHANGE: 'Andere tijd',
  DESTINATION_CHANGE: 'Andere bestemming',
  CANCEL: 'Laten vervallen',
  OTHER: 'Overig',
};

const REQUESTER_LABELS: Record<string, string> = {
  CLIENT: 'Cliënt zelf',
  CONTACT: 'Contactpersoon',
  CARE_ORG: 'Opdrachtgever',
};

function DecisionButton({
  label,
  variant,
  decision,
}: {
  label: string;
  variant: 'primary' | 'outline';
  decision: 'APPROVED' | 'REJECTED';
}) {
  const { pending } = useFormStatus();
  return (
    // name/value on the submit button itself: that is how one form carries two
    // different decisions without a hidden field the user cannot see.
    <Button
      type="submit"
      name="decision"
      value={decision}
      size="sm"
      variant={variant}
      loading={pending}
    >
      {label}
    </Button>
  );
}

export function RequestReview({
  requests,
  canReview,
}: {
  requests: readonly ReviewableRequest[];
  canReview: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    reviewRequestAction,
    IDLE,
  );

  if (requests.length === 0) {
    return (
      <EmptyState
        title="Geen openstaande verzoeken"
        description="Afmeldingen en wijzigingsverzoeken uit de portalen verschijnen hier."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormStatus state={state} />

      <ul className="flex flex-col gap-3">
        {requests.map((request) => (
          <li
            key={request.id}
            className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-medium">
                  {KIND_LABELS[request.kind] ?? request.kind} ·{' '}
                  {request.rideId ? (
                    <Link
                      href={`/ritten/${request.rideId}` as never}
                      className="underline underline-offset-4"
                    >
                      {request.clientName}
                    </Link>
                  ) : (
                    request.clientName
                  )}
                </p>
                <p className="text-sm text-[var(--tp-muted-foreground)]">
                  {request.rideDate
                    ? `Rit op ${request.rideDate} om ${request.rideTime?.slice(0, 5)}`
                    : 'Geen specifieke rit'}
                  {' · aangevraagd door '}
                  {REQUESTER_LABELS[request.requesterKind] ?? request.requesterKind}
                </p>
              </div>
              <Badge variant={request.status === 'PENDING' ? 'warning' : 'neutral'}>
                {request.status === 'PENDING' ? 'In behandeling' : request.status}
              </Badge>
            </div>

            {request.note ? (
              <p className="mt-2 rounded bg-[var(--tp-surface-muted)] px-3 py-2 text-sm">
                {request.note}
              </p>
            ) : null}

            {canReview && request.status === 'PENDING' ? (
              <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="requestId" value={request.id} />
                <div className="min-w-48 flex-1">
                  <label
                    htmlFor={`note-${request.id}`}
                    className="mb-1 block text-xs text-[var(--tp-muted-foreground)]"
                  >
                    Toelichting voor de aanvrager
                  </label>
                  <input
                    id={`note-${request.id}`}
                    name="note"
                    maxLength={300}
                    className="h-9 w-full rounded-[var(--tp-radius)] border border-[var(--tp-border)] px-3 text-sm"
                  />
                </div>
                <DecisionButton
                  label="Goedkeuren"
                  variant="primary"
                  decision="APPROVED"
                />
                <DecisionButton label="Afwijzen" variant="outline" decision="REJECTED" />
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      {/* Approving records the decision; it does not edit the ride. "Cancel this
          ride" from a parent and from the planning are not the same act. */}
      <p className="text-xs text-[var(--tp-muted-foreground)]">
        Goedkeuren legt je besluit vast. De rit zelf pas je daarna aan in de planning,
        zodat er iemand verantwoordelijk is voor het gevolg.
      </p>
    </div>
  );
}
