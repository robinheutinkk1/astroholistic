'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';

/**
 * Live ride updates for the dispatch board and the dashboard.
 *
 * EVERY realtime subscription in the application goes through this hook. That
 * is the point of decision D-10: `postgres_changes` re-evaluates RLS per
 * subscriber per change, which will be the first thing to strain at a few
 * hundred organisations. When that day comes, moving to Realtime Broadcast —
 * one channel per organisation, fed by a database trigger — is a change to this
 * file and nothing else.
 *
 * It deliberately does NOT carry the changed rows into React state. Row
 * payloads would need the same joins the server already does (client name,
 * locations, driver), and re-deriving those in the browser is how two versions
 * of the same view drift apart. Instead it signals "something changed" and the
 * page refetches from the server, which stays the single source of truth.
 */
export type StreamStatus = 'connecting' | 'live' | 'offline';

export interface RideStreamOptions {
  readonly organizationId: string;
  /** Called when something relevant changed. Already debounced. */
  readonly onChange: () => void;
  /** Milliseconds to coalesce bursts. A trip of eight rides updates at once. */
  readonly debounceMs?: number;
}

export function useRideStream({
  organizationId,
  onChange,
  debounceMs = 400,
}: RideStreamOptions): { status: StreamStatus; lastChangeAt: Date | null } {
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [lastChangeAt, setLastChangeAt] = useState<Date | null>(null);

  // Held in a ref so a new callback identity does not tear down the channel;
  // resubscribing on every render would reconnect constantly.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(() => {
    setLastChangeAt(new Date());
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChangeRef.current(), debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`rides:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          // Server-side filter, so the browser is not woken for every tenant.
          // RLS still decides what may be delivered; this only reduces traffic.
          filter: `organization_id=eq.${organizationId}`,
        },
        schedule,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_events',
          filter: `organization_id=eq.${organizationId}`,
        },
        schedule,
      )
      .subscribe((state) => {
        // Compared against the library's own enum rather than string literals,
        // so a renamed state becomes a compile error instead of a board that
        // quietly never reports itself as live.
        setStatus(state === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED ? 'live' : 'offline');
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [organizationId, schedule]);

  return { status, lastChangeAt };
}

/**
 * Fallback polling for when the socket is not up.
 *
 * A dispatch board that silently stops updating is worse than one that never
 * claimed to be live: the dispatcher trusts a stale screen. This keeps the data
 * moving, slowly, whenever realtime is unavailable.
 */
export function usePollWhileOffline(
  status: StreamStatus,
  onPoll: () => void,
  intervalMs = 30_000,
): void {
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  useEffect(() => {
    if (status === 'live') return;
    const timer = setInterval(() => onPollRef.current(), intervalMs);
    return () => clearInterval(timer);
  }, [status, intervalMs]);
}
