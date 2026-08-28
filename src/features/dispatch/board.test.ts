import { describe, expect, it } from 'vitest';
import {
  attentionReason,
  bucketForStatus,
  DISPATCH_BUCKETS,
  LATE_THRESHOLD_MINUTES,
  WAITING_THRESHOLD_MINUTES,
} from './board';
import { RIDE_STATUSES } from '@/features/rides/status';

describe('bucketing', () => {
  it('places every ride status in exactly one bucket', () => {
    // A status that maps nowhere means a ride silently disappears from the
    // dispatcher's board — worse than showing it in the wrong column.
    for (const status of RIDE_STATUSES) {
      const matching = DISPATCH_BUCKETS.filter((bucket) =>
        (bucket.statuses as readonly string[]).includes(status),
      );
      expect(matching, `status ${status}`).toHaveLength(1);
    }
  });

  it('puts a problem ride first', () => {
    expect(DISPATCH_BUCKETS[0]?.key).toBe('problem');
    expect(bucketForStatus('PROBLEM')).toBe('problem');
  });

  it('separates waiting at the door from being on the road', () => {
    expect(bucketForStatus('DRIVER_EN_ROUTE')).toBe('enroute');
    expect(bucketForStatus('DRIVER_ARRIVED')).toBe('arrived');
  });

  it('treats a checked-in client as on board', () => {
    expect(bucketForStatus('CLIENT_CHECKED_IN')).toBe('onboard');
    expect(bucketForStatus('TRIP_STARTED')).toBe('onboard');
  });

  it('keeps absent and cancelled out of the finished column', () => {
    // "Done" must mean the client was actually transported.
    expect(bucketForStatus('CLIENT_ABSENT')).toBe('closed');
    expect(bucketForStatus('CANCELLED')).toBe('closed');
    expect(bucketForStatus('COMPLETED')).toBe('done');
  });
});

describe('attentionReason', () => {
  const now = new Date('2026-08-28T09:00:00Z');
  const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000).toISOString();

  it('flags a reported problem regardless of timing', () => {
    expect(
      attentionReason(
        {
          id: 'a',
          status: 'PROBLEM',
          scheduledPickupAt: minutesAgo(1),
          statusChangedAt: minutesAgo(1),
        },
        now,
      ),
    ).toBe('PROBLEM');
  });

  it('flags a driver who has been at the door too long', () => {
    expect(
      attentionReason(
        {
          id: 'a',
          status: 'DRIVER_ARRIVED',
          scheduledPickupAt: minutesAgo(20),
          statusChangedAt: minutesAgo(WAITING_THRESHOLD_MINUTES),
        },
        now,
      ),
    ).toBe('WAITING_TOO_LONG');
  });

  it('leaves a driver who just arrived alone', () => {
    expect(
      attentionReason(
        {
          id: 'a',
          status: 'DRIVER_ARRIVED',
          scheduledPickupAt: minutesAgo(5),
          statusChangedAt: minutesAgo(2),
        },
        now,
      ),
    ).toBeNull();
  });

  it('flags a ride whose departure time has passed with nobody moving', () => {
    expect(
      attentionReason(
        {
          id: 'a',
          status: 'DRIVER_ASSIGNED',
          scheduledPickupAt: minutesAgo(LATE_THRESHOLD_MINUTES),
          statusChangedAt: null,
        },
        now,
      ),
    ).toBe('NOT_STARTED');
  });

  it('does not flag a ride that is still in the future', () => {
    expect(
      attentionReason(
        {
          id: 'a',
          status: 'SCHEDULED',
          scheduledPickupAt: new Date(now.getTime() + 3_600_000).toISOString(),
          statusChangedAt: null,
        },
        now,
      ),
    ).toBeNull();
  });

  it('does not flag a ride that is under way, however late it started', () => {
    // Once the driver is moving, lateness is no longer something a dispatcher
    // can act on — flagging it would just add noise.
    expect(
      attentionReason(
        {
          id: 'a',
          status: 'TRIP_STARTED',
          scheduledPickupAt: minutesAgo(90),
          statusChangedAt: minutesAgo(60),
        },
        now,
      ),
    ).toBeNull();
  });

  it('does not flag a completed ride', () => {
    expect(
      attentionReason(
        {
          id: 'a',
          status: 'COMPLETED',
          scheduledPickupAt: minutesAgo(120),
          statusChangedAt: minutesAgo(100),
        },
        now,
      ),
    ).toBeNull();
  });

  it('copes with a missing status timestamp', () => {
    expect(
      attentionReason(
        {
          id: 'a',
          status: 'DRIVER_ARRIVED',
          scheduledPickupAt: minutesAgo(60),
          statusChangedAt: null,
        },
        now,
      ),
    ).toBeNull();
  });
});
