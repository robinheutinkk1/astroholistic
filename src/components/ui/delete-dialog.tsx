'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './button';
import { FormStatus } from '@/features/auth/components/form-status';
import { IDLE, type FormState } from '@/lib/errors/form-state';

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Confirmation before a destructive action (§46).
 *
 * `description` should state the concrete consequence — "the 42 existing rides
 * stay in the records" — rather than asking "are you sure?", which nobody reads.
 */
export function DeleteDialog({
  id,
  title,
  description,
  action,
  triggerLabel = 'Verwijderen',
  confirmLabel = 'Definitief verwijderen',
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  triggerLabel?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(action, IDLE);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline">{triggerLabel}</Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-5 shadow-lg">
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[var(--tp-muted-foreground)]">
            {description}
          </Dialog.Description>

          <div className="mt-4">
            <FormStatus state={state} />
          </div>

          <form action={formAction} className="mt-4 flex justify-end gap-2">
            <input type="hidden" name="id" value={id} />
            <Dialog.Close asChild>
              <Button variant="outline" type="button">
                Annuleren
              </Button>
            </Dialog.Close>
            <ConfirmButton label={confirmLabel} />
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
