'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { reportProblemAction } from '../actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="touch" loading={pending}>
      Versturen
    </Button>
  );
}

/**
 * Reporting a problem does NOT change the ride status.
 *
 * A driver reporting "the lift is jammed" while en route must not have the ride
 * pulled out of the workflow — the dispatcher decides what happens next. The
 * report is an event, not a state change.
 */
export function ProblemDialog({ rideId }: { rideId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    reportProblemAction,
    IDLE,
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="touch">
          Probleem melden
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-[var(--tp-border)] bg-[var(--tp-surface)] p-5 pb-8 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">Probleem melden</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[var(--tp-muted-foreground)]">
            De rit gaat gewoon door; de planning kijkt mee.
          </Dialog.Description>

          <form action={formAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="rideId" value={rideId} />
            <textarea
              name="note"
              rows={3}
              maxLength={500}
              required
              placeholder="Wat is er aan de hand?"
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

            <Submit />
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
