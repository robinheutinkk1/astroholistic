/**
 * Ride status vocabulary and state machine (masterprompt §17, §61).
 *
 * This module is deliberately pure: no database, no React, no I/O. It is the
 * single source of truth for what a ride may do next, and it is mirrored by a
 * database trigger in Fase 2 so the rule survives a direct API call
 * (docs/DATABASE.md §7.1).
 */

export const RIDE_STATUSES = [
  'SCHEDULED',
  'DRIVER_ASSIGNED',
  'DRIVER_EN_ROUTE',
  'DRIVER_ARRIVED',
  'CLIENT_CHECKED_IN',
  'TRIP_STARTED',
  'ARRIVED',
  'COMPLETED',
  'CLIENT_ABSENT',
  'CANCELLED',
  'PROBLEM',
] as const;

export type RideStatus = (typeof RIDE_STATUSES)[number];

/** Statuses from which a ride can no longer move on its own. */
export const TERMINAL_STATUSES = [
  'COMPLETED',
  'CLIENT_ABSENT',
  'CANCELLED',
] as const satisfies readonly RideStatus[];

export type TerminalRideStatus = (typeof TERMINAL_STATUSES)[number];

export function isTerminal(status: RideStatus): status is TerminalRideStatus {
  return (TERMINAL_STATUSES as readonly RideStatus[]).includes(status);
}

/**
 * Allowed transitions.
 *
 * CANCELLED is reachable from every non-terminal status, so it is added
 * programmatically below rather than repeated eleven times — repeating it is
 * how one row ends up accidentally missing it.
 */
const BASE_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  SCHEDULED: ['DRIVER_ASSIGNED'],
  // Unassigning a driver returns the ride to the planning pool.
  DRIVER_ASSIGNED: ['DRIVER_EN_ROUTE', 'SCHEDULED'],
  DRIVER_EN_ROUTE: ['DRIVER_ARRIVED'],
  DRIVER_ARRIVED: ['CLIENT_CHECKED_IN', 'CLIENT_ABSENT'],
  CLIENT_CHECKED_IN: ['TRIP_STARTED'],
  TRIP_STARTED: ['ARRIVED'],
  ARRIVED: ['COMPLETED'],
  COMPLETED: [],
  CLIENT_ABSENT: [],
  CANCELLED: [],
  // PROBLEM is recoverable: a dispatcher resolves it back into the flow or
  // closes the ride out. Which of these is permitted is a permission question
  // (rides.dispatch), not a state-machine question.
  PROBLEM: [
    'DRIVER_ASSIGNED',
    'DRIVER_EN_ROUTE',
    'DRIVER_ARRIVED',
    'CLIENT_CHECKED_IN',
    'TRIP_STARTED',
    'ARRIVED',
    'COMPLETED',
    'CLIENT_ABSENT',
  ],
};

const TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = Object.fromEntries(
  RIDE_STATUSES.map((status) => {
    const base = BASE_TRANSITIONS[status];
    if (isTerminal(status)) return [status, base];
    // Filtering out `status` itself matters for PROBLEM, which would otherwise
    // list itself as a valid next status and show up in a status picker.
    const universal = (['PROBLEM', 'CANCELLED'] as const).filter(
      (candidate) => candidate !== status,
    );
    return [status, [...base, ...universal]];
  }),
) as Record<RideStatus, readonly RideStatus[]>;

export function allowedTransitions(from: RideStatus): readonly RideStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: RideStatus, to: RideStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** How an organisation handles client check-out (organization_settings). */
export type CheckoutMode = 'DISABLED' | 'OPTIONAL' | 'REQUIRED';

export interface TransitionContext {
  readonly checkoutMode: CheckoutMode;
  /** Whether a CLIENT_CHECKED_OUT ride_event exists for this ride. */
  readonly hasCheckoutEvent: boolean;
}

export type TransitionCheck =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: TransitionRefusal };

export type TransitionRefusal =
  'SAME_STATUS' | 'TERMINAL' | 'NOT_ALLOWED' | 'CHECKOUT_REQUIRED';

/**
 * Full check including the organisation's check-out policy.
 *
 * Check-out is modelled as an event rather than a status (decision D-09), so
 * the policy shows up here as a guard on ARRIVED → COMPLETED instead of as an
 * extra node in the graph.
 */
export function checkTransition(
  from: RideStatus,
  to: RideStatus,
  context: TransitionContext,
): TransitionCheck {
  if (from === to) return { allowed: false, reason: 'SAME_STATUS' };
  if (isTerminal(from)) return { allowed: false, reason: 'TERMINAL' };
  if (!canTransition(from, to)) return { allowed: false, reason: 'NOT_ALLOWED' };

  if (
    to === 'COMPLETED' &&
    from === 'ARRIVED' &&
    context.checkoutMode === 'REQUIRED' &&
    !context.hasCheckoutEvent
  ) {
    return { allowed: false, reason: 'CHECKOUT_REQUIRED' };
  }

  return { allowed: true };
}

/** Dutch labels for the interface. Kept beside the enum so one cannot drift. */
export const RIDE_STATUS_LABELS: Record<RideStatus, string> = {
  SCHEDULED: 'Gepland',
  DRIVER_ASSIGNED: 'Chauffeur toegewezen',
  DRIVER_EN_ROUTE: 'Onderweg',
  DRIVER_ARRIVED: 'Aangekomen',
  CLIENT_CHECKED_IN: 'Cliënt ingecheckt',
  TRIP_STARTED: 'Rit gestart',
  ARRIVED: 'Op bestemming',
  COMPLETED: 'Afgerond',
  CLIENT_ABSENT: 'Cliënt afwezig',
  CANCELLED: 'Geannuleerd',
  PROBLEM: 'Probleem',
};

export const RIDE_STATUS_REFUSAL_MESSAGES: Record<TransitionRefusal, string> = {
  SAME_STATUS: 'De rit heeft deze status al.',
  TERMINAL: 'Deze rit is afgerond en kan niet meer worden gewijzigd.',
  NOT_ALLOWED: 'Deze statuswijziging is niet toegestaan vanuit de huidige status.',
  CHECKOUT_REQUIRED:
    'Check de cliënt eerst uit. Uitchecken is verplicht binnen deze organisatie.',
};
