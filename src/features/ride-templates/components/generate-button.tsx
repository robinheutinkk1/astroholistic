'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { generateRidesAction } from '../actions';

function Trigger() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" loading={pending}>
      {!pending ? <RefreshCw aria-hidden="true" /> : null}
      Ritten inplannen
    </Button>
  );
}

/**
 * Manual trigger for the generation job.
 *
 * The nightly run does the same work; this exists so a planner who just changed
 * something does not have to wait until tomorrow to see it. Running it twice is
 * harmless — generation is idempotent.
 */
export function GenerateButton() {
  const [state, formAction] = useActionState<FormState, FormData>(
    generateRidesAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Trigger />
      {state.message ? (
        <span
          role="status"
          className={
            state.status === 'error'
              ? 'text-xs text-[var(--tp-danger)]'
              : 'text-xs text-[var(--tp-muted-foreground)]'
          }
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
