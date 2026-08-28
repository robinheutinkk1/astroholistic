'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { FormStatus } from '@/features/auth/components/form-status';
import { deleteClientAction } from '../actions';

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" loading={pending}>
      Definitief verwijderen
    </Button>
  );
}

/**
 * Deleting a client is destructive and easy to do by accident, so it asks first
 * (masterprompt §46). The dialog states the consequence in concrete terms
 * rather than "are you sure?".
 */
export function DeleteClientButton({
  clientId,
  clientName,
  rideCount,
}: {
  clientId: string;
  clientName: string;
  rideCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    deleteClientAction,
    IDLE,
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline">Verwijderen</Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-5 shadow-lg">
          <Dialog.Title className="text-base font-semibold">
            {clientName} verwijderen?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[var(--tp-muted-foreground)]">
            De cliënt verdwijnt uit de lijsten en kan niet meer worden ingepland.
            {rideCount > 0 ? (
              <>
                {' '}
                De {rideCount} bestaande{' '}
                {rideCount === 1 ? 'rit blijft' : 'ritten blijven'} bewaard voor de
                administratie.
              </>
            ) : null}
          </Dialog.Description>

          <div className="mt-4">
            <FormStatus state={state} />
          </div>

          <form action={formAction} className="mt-4 flex justify-end gap-2">
            <input type="hidden" name="clientId" value={clientId} />
            <Dialog.Close asChild>
              <Button variant="outline" type="button">
                Annuleren
              </Button>
            </Dialog.Close>
            <ConfirmButton />
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
