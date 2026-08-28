import { type RideStatus } from '@/features/rides/status';

/**
 * The steps a driver may take, in their own words.
 *
 * Pure domain data, deliberately not behind `server-only`: the driver screen
 * renders it, the service enforces it, and the test suite asserts that every
 * entry is a legal transition in the state machine. A button offering a step
 * the machine refuses would leave a driver tapping with no way forward.
 *
 * Anything not listed here is a planner's job, however legal the state machine
 * considers it — cancelling a ride, for instance.
 */
export interface DriverAction {
  readonly from: RideStatus;
  readonly to: RideStatus;
  readonly label: string;
}

export const DRIVER_ACTIONS: Record<string, DriverAction> = {
  start: { from: 'DRIVER_ASSIGNED', to: 'DRIVER_EN_ROUTE', label: 'Ik ga rijden' },
  arrived: { from: 'DRIVER_EN_ROUTE', to: 'DRIVER_ARRIVED', label: 'Ik ben aangekomen' },
  checkin: { from: 'DRIVER_ARRIVED', to: 'CLIENT_CHECKED_IN', label: 'Cliënt instappen' },
  trip: { from: 'CLIENT_CHECKED_IN', to: 'TRIP_STARTED', label: 'Rit starten' },
  delivered: { from: 'TRIP_STARTED', to: 'ARRIVED', label: 'Cliënt afgeleverd' },
  complete: { from: 'ARRIVED', to: 'COMPLETED', label: 'Rit afronden' },
};

/** The single next step for a ride in this status, if the driver has one. */
export function nextDriverAction(
  status: RideStatus,
): { key: string; action: DriverAction } | null {
  const entry = Object.entries(DRIVER_ACTIONS).find(([, a]) => a.from === status);
  return entry ? { key: entry[0], action: entry[1] } : null;
}
