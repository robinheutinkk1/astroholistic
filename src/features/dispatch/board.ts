import { type RideStatus } from '@/features/rides/status';

/**
 * The dispatch board's columns (masterprompt §29).
 *
 * A dispatcher does not think in eleven statuses; they think in "who needs me
 * right now". These buckets are that view, in the order attention flows: what
 * is broken, what has not started, what is happening, what is done.
 *
 * Pure data so both the server and the live client can bucket the same way.
 */
export const DISPATCH_BUCKETS = [
  {
    key: 'problem',
    label: 'Probleem',
    tone: 'danger',
    statuses: ['PROBLEM'],
    description: 'Vraagt nu aandacht.',
  },
  {
    key: 'waiting',
    label: 'Wacht op vertrek',
    tone: 'neutral',
    statuses: ['SCHEDULED', 'DRIVER_ASSIGNED'],
    description: 'Chauffeur is nog niet vertrokken.',
  },
  {
    key: 'enroute',
    label: 'Onderweg naar cliënt',
    tone: 'info',
    statuses: ['DRIVER_EN_ROUTE'],
    description: 'Op weg naar het ophaaladres.',
  },
  {
    key: 'arrived',
    label: 'Wacht op cliënt',
    tone: 'warning',
    statuses: ['DRIVER_ARRIVED'],
    description: 'Chauffeur staat voor de deur.',
  },
  {
    key: 'onboard',
    label: 'Onderweg met cliënt',
    tone: 'info',
    statuses: ['CLIENT_CHECKED_IN', 'TRIP_STARTED'],
    description: 'Cliënt zit in de bus.',
  },
  {
    key: 'done',
    label: 'Afgerond',
    tone: 'success',
    statuses: ['ARRIVED', 'COMPLETED'],
    description: 'Op bestemming of afgerond.',
  },
  {
    key: 'closed',
    label: 'Niet gereden',
    tone: 'neutral',
    statuses: ['CLIENT_ABSENT', 'CANCELLED'],
    description: 'Afwezig of geannuleerd.',
  },
] as const satisfies readonly {
  key: string;
  label: string;
  tone: string;
  statuses: readonly RideStatus[];
  description: string;
}[];

export type DispatchBucketKey = (typeof DISPATCH_BUCKETS)[number]['key'];

const STATUS_TO_BUCKET = new Map<RideStatus, DispatchBucketKey>(
  DISPATCH_BUCKETS.flatMap((bucket) =>
    bucket.statuses.map((status) => [status, bucket.key] as const),
  ),
);

export function bucketForStatus(status: RideStatus): DispatchBucketKey {
  const bucket = STATUS_TO_BUCKET.get(status);
  // Every status must map somewhere; a ride that vanishes from the board is
  // worse than one in the wrong column. A test asserts this never happens.
  return bucket ?? 'waiting';
}

/**
 * Rides that a dispatcher should look at, in the order they should look.
 *
 * A ride is "stuck" when the driver has been standing at the door longer than
 * the threshold, or when a problem was reported. Sorting by that rather than by
 * time is what turns a list into a board.
 */
export interface AttentionInput {
  readonly id: string;
  readonly status: RideStatus;
  readonly scheduledPickupAt: string;
  readonly statusChangedAt: string | null;
}

export const WAITING_THRESHOLD_MINUTES = 10;
export const LATE_THRESHOLD_MINUTES = 15;

export type AttentionReason = 'PROBLEM' | 'WAITING_TOO_LONG' | 'NOT_STARTED' | null;

export function attentionReason(
  ride: AttentionInput,
  now: Date = new Date(),
): AttentionReason {
  if (ride.status === 'PROBLEM') return 'PROBLEM';

  const minutesSince = (iso: string | null): number | null =>
    iso === null ? null : (now.getTime() - new Date(iso).getTime()) / 60_000;

  if (ride.status === 'DRIVER_ARRIVED') {
    const waiting = minutesSince(ride.statusChangedAt);
    if (waiting !== null && waiting >= WAITING_THRESHOLD_MINUTES)
      return 'WAITING_TOO_LONG';
  }

  if (ride.status === 'SCHEDULED' || ride.status === 'DRIVER_ASSIGNED') {
    const late = minutesSince(ride.scheduledPickupAt);
    if (late !== null && late >= LATE_THRESHOLD_MINUTES) return 'NOT_STARTED';
  }

  return null;
}

export const ATTENTION_LABELS: Record<NonNullable<AttentionReason>, string> = {
  PROBLEM: 'Probleem gemeld',
  WAITING_TOO_LONG: 'Staat al even te wachten',
  NOT_STARTED: 'Vertrektijd verstreken, nog niet onderweg',
};
