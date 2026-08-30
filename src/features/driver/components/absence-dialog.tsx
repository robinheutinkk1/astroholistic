'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { useDriverSubmit } from '../offline/use-driver-submit';
import { ABSENCE_REASON_LABELS, ABSENCE_REASONS } from '@/features/rides/schema';

/**
 * "Client not present."
 *
 * A reason is required rather than free text: five buttons is one tap, a text
 * field is typing on a phone in the cold. The optional note is there for the
 * cases the list does not cover.
 */
export function AbsenceDialog({ rideId }: { rideId: string }) {
  const [open, setOpen] = useState(false);
  const { state, pending, submit } = useDriverSubmit('absence');

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="touch">
          Cliënt is er niet
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-[var(--tp-border)] bg-[var(--tp-surface)] p-5 pb-8 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">
            Wat is er aan de hand?
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[var(--tp-muted-foreground)]">
            De planning krijgt dit meteen te zien.
          </Dialog.Description>

          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit(new FormData(event.currentTarget), 'Afwezigheidsmelding');
            }}
          >
            <input type="hidden" name="rideId" value={rideId} />

            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Reden</legend>
              {ABSENCE_REASONS.map((reason, index) => (
                <label
                  key={reason}
                  className="flex min-h-12 items-center gap-3 rounded-[var(--tp-radius)] border border-[var(--tp-border)] px-4 text-base"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason}
                    defaultChecked={index === 0}
                    className="size-5"
                  />
                  {ABSENCE_REASON_LABELS[reason]}
                </label>
              ))}
            </fieldset>

            <textarea
              name="note"
              rows={2}
              maxLength={300}
              placeholder="Toelichting (niet verplicht)"
              className="w-full rounded-[var(--tp-radius)] border border-[var(--tp-border)] px-3 py-2 text-base"
            />

            {state.status === 'error' ? (
              <p role="alert" className="text-sm text-[var(--tp-danger)]">
                {state.message}
              </p>
            ) : null}
            {state.status === 'success' && state.message ? (
              <p role="status" className="text-sm text-[var(--tp-muted-foreground)]">
                {state.message}
              </p>
            ) : null}

            <Button type="submit" variant="danger" size="touch" loading={pending}>
              Afwezigheid doorgeven
            </Button>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="touch">
                Annuleren
              </Button>
            </Dialog.Close>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
