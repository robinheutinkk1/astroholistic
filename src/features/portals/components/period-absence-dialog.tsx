'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { submitRequestAction } from '../actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="touch" loading={pending}>
      Afmelding versturen
    </Button>
  );
}

/**
 * "Jan is drie weken op vakantie" in één verzoek, in plaats van vijftien keer
 * afmelden per rit. Het verzoek gaat door dezelfde molen als alle andere
 * (decision D-08): de planning beoordeelt, en past daarna zelf de ritten aan.
 *
 * De min op de datumvelden is de datum van het toestel — cosmetisch, tegen
 * tikfouten. De echte grens trekt de server, in de tijdzone van de organisatie.
 */
export function PeriodAbsenceDialog({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    submitRequestAction,
    IDLE,
  );
  const deviceToday = new Date().toISOString().slice(0, 10);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          Langere tijd afmelden
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-[var(--tp-border)] bg-[var(--tp-surface)] p-5 pb-8 shadow-lg sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(30rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--tp-radius)] sm:border">
          <Dialog.Title className="text-lg font-semibold">
            Voor een periode afmelden
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[var(--tp-muted-foreground)]">
            Voor {clientName}, bijvoorbeeld bij vakantie of opname. De planning beoordeelt
            de afmelding en past daarna de ritten aan; tot die tijd blijven ze gewoon
            staan.
          </Dialog.Description>

          <form action={formAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="rideId" value="" />
            <input type="hidden" name="kind" value="ABSENCE" />

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Eerste dag
                <input
                  type="date"
                  name="from"
                  required
                  min={deviceToday}
                  className="min-h-11 rounded-[var(--tp-radius)] border border-[var(--tp-border)] px-3 text-base"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Laatste dag
                <input
                  type="date"
                  name="to"
                  required
                  min={deviceToday}
                  className="min-h-11 rounded-[var(--tp-radius)] border border-[var(--tp-border)] px-3 text-base"
                />
              </label>
            </div>

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
