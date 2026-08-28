/**
 * Detecting a driver or vehicle booked in two places at once.
 *
 * Group trips have this enforced in the database with exclusion constraints
 * (migration 0014). Individual rides do not carry an end time, so there is
 * nothing to build a range from — the check here is an application-level
 * heuristic on top, and it is deliberately advisory rather than blocking.
 *
 * Why advisory: a planner sometimes knows better than the model. Two pickups
 * fifteen minutes apart on the same street are fine; the same gap across town
 * is not, and the system cannot tell the difference without routing. Blocking
 * would train planners to work around the tool.
 */
export interface RideSlot {
  readonly rideId: string;
  readonly pickupAt: string;
  readonly driverId: string | null;
  readonly vehicleId: string | null;
}

/** Minutes within which two pickups by the same driver look implausible. */
export const DEFAULT_CONFLICT_WINDOW_MINUTES = 30;

export interface Conflict {
  readonly rideId: string;
  readonly otherRideId: string;
  readonly kind: 'DRIVER' | 'VEHICLE';
  readonly minutesApart: number;
}

export function findConflicts(
  slots: readonly RideSlot[],
  windowMinutes: number = DEFAULT_CONFLICT_WINDOW_MINUTES,
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i]!;
      const b = slots[j]!;

      const minutesApart = Math.abs(
        (new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime()) / 60_000,
      );
      if (minutesApart >= windowMinutes) continue;

      if (a.driverId && a.driverId === b.driverId) {
        conflicts.push({
          rideId: a.rideId,
          otherRideId: b.rideId,
          kind: 'DRIVER',
          minutesApart: Math.round(minutesApart),
        });
      }
      if (a.vehicleId && a.vehicleId === b.vehicleId) {
        conflicts.push({
          rideId: a.rideId,
          otherRideId: b.rideId,
          kind: 'VEHICLE',
          minutesApart: Math.round(minutesApart),
        });
      }
    }
  }

  return conflicts;
}

export function conflictsByRide(conflicts: readonly Conflict[]): Map<string, Conflict[]> {
  const byRide = new Map<string, Conflict[]>();
  for (const conflict of conflicts) {
    for (const id of [conflict.rideId, conflict.otherRideId]) {
      const list = byRide.get(id) ?? [];
      // Store the conflict from the perspective of whichever ride is the key.
      list.push(
        id === conflict.rideId
          ? conflict
          : { ...conflict, rideId: conflict.otherRideId, otherRideId: conflict.rideId },
      );
      byRide.set(id, list);
    }
  }
  return byRide;
}
