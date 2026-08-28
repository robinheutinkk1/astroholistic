'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Accessibility } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { usePollWhileOffline, useRideStream } from '@/hooks/use-ride-stream';
import { TRANSPORT_REQUIREMENT_LABELS } from '@/features/rides/schema';
import { ATTENTION_LABELS, DISPATCH_BUCKETS } from '../board';
import type { DispatchBoard as Board, DispatchRide } from '../service';
import { LiveIndicator } from './live-indicator';

const TONE_BADGE = {
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  success: 'success',
  neutral: 'neutral',
} as const;

function RideCard({ ride }: { ride: DispatchRide }) {
  return (
    <li className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/ritten/${ride.id}` as never}
          className="font-medium underline-offset-4 hover:underline"
        >
          {ride.clientName}
        </Link>
        <span className="shrink-0 text-sm text-[var(--tp-muted-foreground)] tabular-nums">
          {ride.scheduledPickupTime.slice(0, 5)}
        </span>
      </div>

      <p className="mt-0.5 truncate text-xs text-[var(--tp-muted-foreground)]">
        {ride.driverName ?? 'Geen chauffeur'}
        {ride.vehiclePlate ? ` · ${ride.vehiclePlate}` : ''}
      </p>
      <p className="truncate text-xs text-[var(--tp-muted-foreground)]">
        {ride.pickupName} → {ride.destinationName}
      </p>

      {ride.transportRequirements.length > 0 ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--tp-warning)]">
          <Accessibility className="size-3" aria-hidden="true" />
          {ride.transportRequirements
            .map(
              (r) =>
                TRANSPORT_REQUIREMENT_LABELS[
                  r as keyof typeof TRANSPORT_REQUIREMENT_LABELS
                ] ?? r,
            )
            .join(', ')}
        </p>
      ) : null}

      {ride.attention ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[var(--tp-danger)]">
          <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
          {ATTENTION_LABELS[ride.attention]}
        </p>
      ) : null}
    </li>
  );
}

export function DispatchBoard({
  board,
  organizationId,
}: {
  board: Board;
  organizationId: string;
}) {
  const router = useRouter();

  // Refetch from the server rather than patching rows in the browser: the
  // server already joins client, driver and locations, and re-deriving those
  // here is how two versions of the same board drift apart.
  const refresh = useCallback(() => router.refresh(), [router]);

  const { status, lastChangeAt } = useRideStream({ organizationId, onChange: refresh });
  usePollWhileOffline(status, refresh);

  if (board.rides.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <LiveIndicator status={status} lastChangeAt={lastChangeAt} />
        <EmptyState
          title="Geen ritten vandaag"
          description="Zodra er ritten zijn ingepland verschijnen ze hier vanzelf."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <LiveIndicator status={status} lastChangeAt={lastChangeAt} />

      {board.needsAttention.length > 0 ? (
        <section
          aria-labelledby="attention-heading"
          className="rounded-[var(--tp-radius)] border-2 border-[var(--tp-danger)] p-3"
        >
          <h2 id="attention-heading" className="mb-2 text-sm font-semibold">
            Vraagt aandacht ({board.needsAttention.length})
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {board.needsAttention.map((ride) => (
              <RideCard key={ride.id} ride={ride} />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {DISPATCH_BUCKETS.map((bucket) => {
          const rides = board.rides.filter((ride) => ride.bucket === bucket.key);
          if (rides.length === 0) return null;

          return (
            <section key={bucket.key} aria-labelledby={`bucket-${bucket.key}`}>
              <div className="mb-2 flex items-center gap-2">
                <h2 id={`bucket-${bucket.key}`} className="text-sm font-semibold">
                  {bucket.label}
                </h2>
                <Badge variant={TONE_BADGE[bucket.tone]}>{rides.length}</Badge>
              </div>
              <p className="mb-2 text-xs text-[var(--tp-muted-foreground)]">
                {bucket.description}
              </p>
              <ul className="flex flex-col gap-2">
                {rides.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {board.rides.length} ritten, waarvan {board.needsAttention.length} met
        aandachtspunt. Statussen:{' '}
        {DISPATCH_BUCKETS.map(
          (b) => `${b.label}: ${board.rides.filter((r) => r.bucket === b.key).length}`,
        ).join(', ')}
        .
      </p>

      <p className="text-xs text-[var(--tp-muted-foreground)]">
        Klik op een cliënt om de rit te openen en de status aan te passen.
      </p>
    </div>
  );
}
