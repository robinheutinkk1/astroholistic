import { type FormState } from '@/lib/errors/form-state';

/**
 * Renders the outcome of a Server Action.
 *
 * role="alert" so the message is announced by a screen reader when it appears
 * after submitting — a silently-appearing error is invisible to anyone not
 * looking at that part of the page (§48).
 */
export function FormStatus({ state }: { state: FormState }) {
  if (state.status === 'idle' || !state.message) return null;

  const isError = state.status === 'error';
  return (
    <p
      role="alert"
      className={
        isError
          ? 'rounded-[var(--tp-radius)] bg-red-50 px-3 py-2 text-sm text-[var(--tp-danger)]'
          : 'rounded-[var(--tp-radius)] bg-green-50 px-3 py-2 text-sm text-green-800'
      }
    >
      {state.message}
    </p>
  );
}
