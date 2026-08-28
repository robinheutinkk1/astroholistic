'use client';

import { type StreamStatus } from '@/hooks/use-ride-stream';

/**
 * Shows whether the board is actually live.
 *
 * A dispatch board that silently stops updating is worse than one that never
 * claimed to be live: the dispatcher keeps trusting a frozen screen. When the
 * connection drops this says so, and says what happens instead.
 */
export function LiveIndicator({
  status,
  lastChangeAt,
}: {
  status: StreamStatus;
  lastChangeAt: Date | null;
}) {
  const time = lastChangeAt
    ? new Intl.DateTimeFormat('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(lastChangeAt)
    : null;

  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-xs text-[var(--tp-muted-foreground)]"
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${
          status === 'live'
            ? 'bg-[var(--color-status-completed)]'
            : status === 'connecting'
              ? 'bg-[var(--tp-warning)]'
              : 'bg-[var(--tp-danger)]'
        }`}
      />
      {status === 'live'
        ? time
          ? `Live · laatste wijziging ${time}`
          : 'Live'
        : status === 'connecting'
          ? 'Verbinden…'
          : 'Geen live verbinding · scherm ververst elke 30 seconden'}
    </p>
  );
}
