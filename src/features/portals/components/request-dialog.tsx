'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { submitRequestAction } from '../actions';

const KIND_LABELS = {
  ABSENCE: 'Afmelden voor deze rit',
  TIME_CHANGE: 'Andere tijd vragen',
  DESTINATION_CHANGE: 'Andere bestemming vragen',
  CANCEL: 'Rit laten vervallen',
  OTHER: 'Iets anders',
} as const;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="touch" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * A portal user asks; a planner decides (decision D-08).
 *
 * The wording says so plainly. Calling the button "cancel" would imply the ride
 * is gone, and a parent who believes that stops expecting the bus.
 */
export function RequestDialog({
  clientId,
  rideId,
  clientName,
  rideLabel,
  kinds,
  triggerLabel,
  variant = 'outline',
}: {
  clientId: string;
  rideId?: string | null;
  clientName: string;
  rideLabel?: string;
  kinds: readonly (keyof typeof KIND_LABELS)[];
  triggerLabel: string;
  variant?: 'outline' | 'primary';
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    submitRequestAction,
    IDLE,
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant={variant} size="sm">
          {triggerLabel}
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-[var(--tp-border)] bg-[var(--tp-surface)] p-5 pb-8 shadow-lg sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(30rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--tp-radius)] sm:border">
          <Dialog.Title className="text-lg font-semibold">Verzoek indienen</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[var(--tp-muted-foreground)]">
            Voor {clientName}
            {rideLabel ? `, ${rideLabel}` : ''}. De planning beoordeelt je verzoek en je
            ziet hier wat ermee gebeurt. De rit verandert niet meteen.
          </Dialog.Description>

          <form action={formAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="rideId" value={rideId ?? ''} />

            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Wat wil je vragen?</legend>
              {kinds.map((kind, index) => (
                <label
                  key={kind}
                  className="flex min-h-12 items-center gap-3 rounded-[var(--tp-radius)] border border-[var(--tp-border)] px-4 text-base"
                >
                  <input
                    type="radio"
                    name="kind"
                    value={kind}
                    defaultChecked={index === 0}
                    className="size-5"
                  />
                  {KIND_LABELS[kind]}
                </label>
              ))}
            </fieldset>

            <textarea
              name="note"
              rows={3}
              maxLength={500}
              placeholder="Toelichting (helpt de planning)"
              className="w-full rounded-[var(--tp-radius)] border border-[var(--tp-border)] px-3 py-2 text-base"
            />

            {state.message ? (
              <p
                role="alert"
                className={
                  state.status === 'error'
                    ? 'text-sm text-[var(--tp-danger)]'
                    : 'text-sm text-green-700'
                }
              >
                {state.message}
              </p>
            ) : null}

            <Submit label="Versturen" />
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="touch">
                Sluiten
              </Button>
            </Dialog.Close>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
