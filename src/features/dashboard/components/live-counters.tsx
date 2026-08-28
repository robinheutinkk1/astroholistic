'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePollWhileOffline, useRideStream } from '@/hooks/use-ride-stream';

/**
 * Keeps the dashboard figures current without the user pressing anything.
 *
 * Debounced hard (three seconds): a dashboard is glanced at, not stared at, so
 * an update a moment later costs nothing — while a group trip whose eight rides
 * all change at once would otherwise trigger eight refetches.
 */
export function LiveCounters({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  const { status } = useRideStream({
    organizationId,
    onChange: refresh,
    debounceMs: 3000,
  });
  // A dashboard is less time-critical than dispatch, so it polls more slowly.
  usePollWhileOffline(status, refresh, 60_000);

  return null;
}
