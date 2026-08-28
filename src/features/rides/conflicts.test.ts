import { describe, expect, it } from 'vitest';
import { conflictsByRide, findConflicts, type RideSlot } from './conflicts';

const slot = (
  rideId: string,
  pickupAt: string,
  driverId: string | null = null,
  vehicleId: string | null = null,
): RideSlot => ({ rideId, pickupAt, driverId, vehicleId });

describe('findConflicts', () => {
  it('flags one driver on two nearby pickups', () => {
    const conflicts = findConflicts([
      slot('a', '2026-08-28T08:00:00Z', 'driver-1'),
      slot('b', '2026-08-28T08:10:00Z', 'driver-1'),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe('DRIVER');
    expect(conflicts[0]?.minutesApart).toBe(10);
  });

  it('leaves pickups outside the window alone', () => {
    expect(
      findConflicts([
        slot('a', '2026-08-28T08:00:00Z', 'driver-1'),
        slot('b', '2026-08-28T09:00:00Z', 'driver-1'),
      ]),
    ).toEqual([]);
  });

  it('flags one vehicle on two nearby pickups', () => {
    const conflicts = findConflicts([
      slot('a', '2026-08-28T08:00:00Z', 'driver-1', 'bus-1'),
      slot('b', '2026-08-28T08:05:00Z', 'driver-2', 'bus-1'),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe('VEHICLE');
  });

  it('reports both a driver and a vehicle clash on the same pair', () => {
    const conflicts = findConflicts([
      slot('a', '2026-08-28T08:00:00Z', 'driver-1', 'bus-1'),
      slot('b', '2026-08-28T08:05:00Z', 'driver-1', 'bus-1'),
    ]);
    expect(conflicts.map((c) => c.kind).sort()).toEqual(['DRIVER', 'VEHICLE']);
  });

  it('ignores unassigned rides', () => {
    // Two rides at the same minute with nobody assigned is normal planning,
    // not a conflict.
    expect(
      findConflicts([
        slot('a', '2026-08-28T08:00:00Z', null, null),
        slot('b', '2026-08-28T08:00:00Z', null, null),
      ]),
    ).toEqual([]);
  });

  it('does not flag different drivers at the same moment', () => {
    expect(
      findConflicts([
        slot('a', '2026-08-28T08:00:00Z', 'driver-1'),
        slot('b', '2026-08-28T08:00:00Z', 'driver-2'),
      ]),
    ).toEqual([]);
  });

  it('respects a custom window', () => {
    const slots = [
      slot('a', '2026-08-28T08:00:00Z', 'driver-1'),
      slot('b', '2026-08-28T08:40:00Z', 'driver-1'),
    ];
    expect(findConflicts(slots, 30)).toEqual([]);
    expect(findConflicts(slots, 60)).toHaveLength(1);
  });

  it('handles an empty and a single-item list', () => {
    expect(findConflicts([])).toEqual([]);
    expect(findConflicts([slot('a', '2026-08-28T08:00:00Z', 'driver-1')])).toEqual([]);
  });

  it('finds every pair in a cluster of three', () => {
    const conflicts = findConflicts([
      slot('a', '2026-08-28T08:00:00Z', 'driver-1'),
      slot('b', '2026-08-28T08:05:00Z', 'driver-1'),
      slot('c', '2026-08-28T08:10:00Z', 'driver-1'),
    ]);
    expect(conflicts).toHaveLength(3);
  });
});

describe('conflictsByRide', () => {
  it('lists a conflict under both rides involved', () => {
    const conflicts = findConflicts([
      slot('a', '2026-08-28T08:00:00Z', 'driver-1'),
      slot('b', '2026-08-28T08:10:00Z', 'driver-1'),
    ]);
    const byRide = conflictsByRide(conflicts);

    // A planner looking at either ride must see the warning; showing it on only
    // one of the two is how the other slips through.
    expect(byRide.get('a')).toHaveLength(1);
    expect(byRide.get('b')).toHaveLength(1);
    expect(byRide.get('b')?.[0]?.otherRideId).toBe('a');
  });

  it('is empty when there are no conflicts', () => {
    expect(conflictsByRide([]).size).toBe(0);
  });
});
