import { describe, expect, it } from 'vitest';
import {
  allowedTransitions,
  canTransition,
  checkTransition,
  isTerminal,
  RIDE_STATUSES,
  RIDE_STATUS_LABELS,
  type RideStatus,
  type TransitionContext,
} from './status';

const NO_CHECKOUT: TransitionContext = {
  checkoutMode: 'DISABLED',
  hasCheckoutEvent: false,
};

describe('the happy path', () => {
  it('walks the full driver workflow from SCHEDULED to COMPLETED', () => {
    const flow: RideStatus[] = [
      'SCHEDULED',
      'DRIVER_ASSIGNED',
      'DRIVER_EN_ROUTE',
      'DRIVER_ARRIVED',
      'CLIENT_CHECKED_IN',
      'TRIP_STARTED',
      'ARRIVED',
      'COMPLETED',
    ];

    for (let i = 0; i < flow.length - 1; i += 1) {
      const from = flow[i]!;
      const to = flow[i + 1]!;
      expect(canTransition(from, to), `${from} → ${to}`).toBe(true);
    }
  });
});

describe('forbidden shortcuts', () => {
  /** The explicit requirement from §17: no jumping straight to COMPLETED. */
  it('refuses SCHEDULED → COMPLETED', () => {
    expect(canTransition('SCHEDULED', 'COMPLETED')).toBe(false);
  });

  it('refuses skipping check-in', () => {
    expect(canTransition('DRIVER_ARRIVED', 'TRIP_STARTED')).toBe(false);
  });

  it('refuses starting a trip before the driver has arrived', () => {
    expect(canTransition('DRIVER_ASSIGNED', 'TRIP_STARTED')).toBe(false);
  });

  it('refuses moving backwards through the flow', () => {
    expect(canTransition('TRIP_STARTED', 'DRIVER_ARRIVED')).toBe(false);
    expect(canTransition('ARRIVED', 'CLIENT_CHECKED_IN')).toBe(false);
  });
});

describe('terminal statuses', () => {
  it.each(['COMPLETED', 'CLIENT_ABSENT', 'CANCELLED'] as const)(
    '%s is terminal and allows no transitions',
    (status) => {
      expect(isTerminal(status)).toBe(true);
      expect(allowedTransitions(status)).toEqual([]);
    },
  );

  it('refuses to reopen a cancelled ride', () => {
    expect(checkTransition('CANCELLED', 'SCHEDULED', NO_CHECKOUT)).toEqual({
      allowed: false,
      reason: 'TERMINAL',
    });
  });

  it('refuses to revive an absent client into a completed ride', () => {
    expect(checkTransition('CLIENT_ABSENT', 'COMPLETED', NO_CHECKOUT)).toEqual({
      allowed: false,
      reason: 'TERMINAL',
    });
  });
});

describe('cancellation and problems', () => {
  const active = RIDE_STATUSES.filter((status) => !isTerminal(status));

  it.each(active)('%s can always be cancelled', (status) => {
    expect(canTransition(status, 'CANCELLED')).toBe(true);
  });

  it.each(active.filter((s) => s !== 'PROBLEM'))(
    '%s can always be flagged as a problem',
    (status) => {
      expect(canTransition(status, 'PROBLEM')).toBe(true);
    },
  );

  it('lets a dispatcher resolve a problem back into the flow', () => {
    expect(canTransition('PROBLEM', 'DRIVER_EN_ROUTE')).toBe(true);
    expect(canTransition('PROBLEM', 'COMPLETED')).toBe(true);
  });

  it('does not allow a problem ride to return to SCHEDULED', () => {
    // A driver was already involved; returning to the unassigned pool would
    // lose that fact silently.
    expect(canTransition('PROBLEM', 'SCHEDULED')).toBe(false);
  });
});

describe('absence', () => {
  it('can only be recorded once the driver is on site', () => {
    expect(canTransition('DRIVER_ARRIVED', 'CLIENT_ABSENT')).toBe(true);
    expect(canTransition('SCHEDULED', 'CLIENT_ABSENT')).toBe(false);
    expect(canTransition('DRIVER_EN_ROUTE', 'CLIENT_ABSENT')).toBe(false);
  });
});

describe('check-out policy (decision D-09)', () => {
  it('allows completion without check-out when check-out is disabled', () => {
    expect(checkTransition('ARRIVED', 'COMPLETED', NO_CHECKOUT)).toEqual({
      allowed: true,
    });
  });

  it('allows completion without check-out when check-out is optional', () => {
    expect(
      checkTransition('ARRIVED', 'COMPLETED', {
        checkoutMode: 'OPTIONAL',
        hasCheckoutEvent: false,
      }),
    ).toEqual({ allowed: true });
  });

  it('blocks completion when check-out is required and missing', () => {
    expect(
      checkTransition('ARRIVED', 'COMPLETED', {
        checkoutMode: 'REQUIRED',
        hasCheckoutEvent: false,
      }),
    ).toEqual({ allowed: false, reason: 'CHECKOUT_REQUIRED' });
  });

  it('allows completion once the check-out event exists', () => {
    expect(
      checkTransition('ARRIVED', 'COMPLETED', {
        checkoutMode: 'REQUIRED',
        hasCheckoutEvent: true,
      }),
    ).toEqual({ allowed: true });
  });

  it('does not apply the check-out guard to a problem ride being closed out', () => {
    // A dispatcher closing a PROBLEM ride cannot be blocked by a check-out that
    // will never happen — the client was never picked up.
    expect(
      checkTransition('PROBLEM', 'COMPLETED', {
        checkoutMode: 'REQUIRED',
        hasCheckoutEvent: false,
      }),
    ).toEqual({ allowed: true });
  });
});

describe('invariants', () => {
  it('refuses a transition to the same status', () => {
    expect(checkTransition('SCHEDULED', 'SCHEDULED', NO_CHECKOUT)).toEqual({
      allowed: false,
      reason: 'SAME_STATUS',
    });
  });

  it('has a Dutch label for every status', () => {
    for (const status of RIDE_STATUSES) {
      expect(RIDE_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('never lists a status as its own successor', () => {
    for (const status of RIDE_STATUSES) {
      expect(allowedTransitions(status)).not.toContain(status);
    }
  });

  it('makes every non-terminal status reachable from SCHEDULED', () => {
    // Guards against a status that exists in the enum but that no workflow can
    // ever produce — a silent dead branch.
    const seen = new Set<RideStatus>(['SCHEDULED']);
    const queue: RideStatus[] = ['SCHEDULED'];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of allowedTransitions(current)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...RIDE_STATUSES].sort());
  });
});
