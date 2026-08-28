'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkinAction, type CheckinState } from '../actions';

const IDLE_STATE: CheckinState = { status: 'idle' };

/**
 * Performs the check-in as soon as the page opens.
 *
 * A driver taps a tag with one hand while holding a door with the other. Making
 * them press a second button on the page would defeat the point of the tag.
 */
export function CheckinPanel({ token }: { token: string }) {
  const [state, formAction] = useActionState<CheckinState, FormData>(
    checkinAction,
    IDLE_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    formRef.current?.requestSubmit();
  }, []);

  const succeeded = state.outcome === 'CHECKED_IN';
  const alreadyDone = state.outcome === 'ALREADY_CHECKED_IN';
  const pending = state.status === 'idle';

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-6 text-center">
      <form ref={formRef} action={formAction} className="hidden">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="source" value="NFC" />
      </form>

      {pending ? (
        <p role="status" className="text-base text-[var(--tp-muted-foreground)]">
          Bezig met inchecken…
        </p>
      ) : (
        <>
          <div
            className={
              succeeded
                ? 'text-[var(--color-status-completed)]'
                : alreadyDone
                  ? 'text-[var(--color-status-started)]'
                  : 'text-[var(--tp-danger)]'
            }
          >
            {succeeded ? (
              <CheckCircle2 className="mx-auto size-16" aria-hidden="true" />
            ) : alreadyDone ? (
              <Info className="mx-auto size-16" aria-hidden="true" />
            ) : (
              <XCircle className="mx-auto size-16" aria-hidden="true" />
            )}
          </div>

          {/* The client's name appears here and nowhere earlier: only after the
              server confirmed this driver is assigned to this ride. */}
          {state.clientName ? (
            <p className="text-2xl font-semibold">{state.clientName}</p>
          ) : null}

          <p role="alert" className="text-base">
            {state.message}
          </p>

          <div className="flex flex-col gap-2">
            <Button asChild size="touch">
              <Link href="/driver">Naar mijn ritten</Link>
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
