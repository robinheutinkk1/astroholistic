import 'server-only';
import { requireUser } from '@/features/rbac/session';
import { createClient } from '@/lib/supabase/server';
import {
  AuthorizationError,
  NotFoundError,
  StateTransitionError,
} from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { todayInTimezone } from '@/lib/datetime/timezone';
import {
  checkTransition,
  RIDE_STATUS_REFUSAL_MESSAGES,
  type CheckoutMode,
  type RideStatus,
} from '@/features/rides/status';
import { type Tables } from '@/types/database';
import { DRIVER_ACTIONS } from './workflow';

/**
 * Driver-facing operations.
 *
 * These deliberately do NOT go through the planner service. A driver holds
 * neither `rides.dispatch` nor `rides.update`, and giving them those would let
 * them change any ride in the organisation.
 *
 * Instead, authorisation here comes from the assignment itself: the driver of
 * a ride may advance that ride through the workflow, and nothing else. RLS
 * enforces the same boundary independently.
 */

export interface DriverContext {
  readonly userId: string;
  readonly driverId: string;
  readonly organizationId: string;
  readonly timeZone: string;
  readonly checkoutMode: CheckoutMode;
  readonly gpsEnabled: boolean;
}

/** The driver record for the signed-in user, or null if they are not a driver. */
export async function getDriverContext(): Promise<DriverContext | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, organization_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!driver) return null;

  const { data: settings } = await supabase
    .from('organization_settings')
    .select('timezone, checkout_mode, gps_capture_enabled')
    .eq('organization_id', driver.organization_id)
    .maybeSingle();

  return {
    userId: user.id,
    driverId: driver.id,
    organizationId: driver.organization_id,
    timeZone: settings?.timezone ?? 'Europe/Amsterdam',
    checkoutMode: settings?.checkout_mode ?? 'OPTIONAL',
    gpsEnabled: settings?.gps_capture_enabled ?? false,
  };
}

export interface DriverRide {
  readonly id: string;
  readonly scheduled_pickup_time: string;
  readonly status: RideStatus;
  readonly transport_requirements: string[];
  readonly notes: string | null;
  readonly trip_id: string | null;
  readonly client: { first_name: string; last_name: string; phone: string | null } | null;
  readonly pickup: PlaceSummary | null;
  readonly destination: PlaceSummary | null;
}

export interface PlaceSummary {
  readonly name: string;
  readonly address_line1: string | null;
  readonly postal_code: string | null;
  readonly city: string | null;
  readonly access_notes: string | null;
}

const DRIVER_RIDE_SELECT = `
  id, scheduled_pickup_time, status, transport_requirements, notes, trip_id,
  client:clients!rides_client_id_fkey (first_name, last_name, phone),
  pickup:locations!rides_pickup_location_id_fkey (name, address_line1, postal_code, city, access_notes),
  destination:locations!rides_destination_location_id_fkey (name, address_line1, postal_code, city, access_notes)
`;

export async function getTodayRides(context: DriverContext): Promise<DriverRide[]> {
  const supabase = await createClient();
  const today = todayInTimezone(context.timeZone);

  const { data } = await supabase
    .from('rides')
    .select(DRIVER_RIDE_SELECT)
    .eq('driver_id', context.driverId)
    .eq('scheduled_date', today)
    .order('scheduled_pickup_at', { ascending: true })
    .order('id', { ascending: true });

  return data ?? [];
}

export async function getDriverRide(
  context: DriverContext,
  rideId: string,
): Promise<DriverRide | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('rides')
    .select(DRIVER_RIDE_SELECT)
    // Scoped to this driver: another driver's ride is simply not found.
    .eq('driver_id', context.driverId)
    .eq('id', rideId)
    .maybeSingle();
  return data ?? null;
}

export interface GpsFix {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number | null;
}

const EVENT_FOR_STATUS: Partial<Record<RideStatus, Tables<'ride_events'>['event_type']>> =
  {
    DRIVER_EN_ROUTE: 'DRIVER_EN_ROUTE',
    DRIVER_ARRIVED: 'DRIVER_ARRIVED',
    CLIENT_CHECKED_IN: 'CLIENT_CHECKED_IN',
    TRIP_STARTED: 'TRIP_STARTED',
    ARRIVED: 'ARRIVED',
    COMPLETED: 'COMPLETED',
    CLIENT_ABSENT: 'CLIENT_ABSENT',
  };

export async function performDriverAction(
  context: DriverContext,
  rideId: string,
  actionKey: string,
  gps: GpsFix | null,
  source: Tables<'ride_events'>['source'] = 'MANUAL',
): Promise<Result<{ status: RideStatus }>> {
  const action = DRIVER_ACTIONS[actionKey];
  if (!action) return err(new NotFoundError('Onbekende actie.'));

  const supabase = await createClient();

  const { data: ride } = await supabase
    .from('rides')
    .select('id, status, organization_id, driver_id')
    .eq('id', rideId)
    .eq('driver_id', context.driverId)
    .maybeSingle();

  // Not assigned to this driver reads as "not found", so the response cannot be
  // used to discover other drivers' rides.
  if (!ride) return err(new NotFoundError('Deze rit staat niet op jouw naam.'));

  const events = await supabase
    .from('ride_events')
    .select('event_type')
    .eq('ride_id', rideId);
  const hasCheckoutEvent = (events.data ?? []).some(
    (event) => event.event_type === 'CLIENT_CHECKED_OUT',
  );

  const check = checkTransition(ride.status, action.to, {
    checkoutMode: context.checkoutMode,
    hasCheckoutEvent,
  });
  if (!check.allowed) {
    return err(new StateTransitionError(RIDE_STATUS_REFUSAL_MESSAGES[check.reason]));
  }

  const milestone: Partial<Tables<'rides'>> = {};
  if (action.to === 'CLIENT_CHECKED_IN') {
    milestone.checked_in_at = new Date().toISOString();
    milestone.checked_in_method = source;
  }
  if (action.to === 'TRIP_STARTED') milestone.started_at = new Date().toISOString();
  if (action.to === 'ARRIVED') milestone.arrived_at = new Date().toISOString();
  if (action.to === 'COMPLETED') milestone.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from('rides')
    .update({ status: action.to, ...milestone })
    .eq('id', rideId)
    .eq('driver_id', context.driverId);

  if (error) {
    return err(
      new StateTransitionError(
        'Deze stap kan nu niet. Ververs het scherm en probeer het opnieuw.',
      ),
    );
  }

  const eventType = EVENT_FOR_STATUS[action.to];
  if (eventType) {
    await supabase.from('ride_events').insert({
      organization_id: ride.organization_id,
      ride_id: rideId,
      event_type: eventType,
      actor_user_id: context.userId,
      actor_kind: 'DRIVER',
      source,
      // GPS only when the organisation enabled it AND the device granted it
      // (docs/SECURITY.md §9). No background tracking, ever.
      ...(gps && context.gpsEnabled
        ? { latitude: gps.latitude, longitude: gps.longitude, accuracy_m: gps.accuracy }
        : {}),
    });
  }

  return ok({ status: action.to });
}

export async function reportAbsence(
  context: DriverContext,
  rideId: string,
  reason: Tables<'rides'>['absence_reason'],
  note: string | null,
  gps: GpsFix | null,
): Promise<Result<null>> {
  const supabase = await createClient();

  const { data: ride } = await supabase
    .from('rides')
    .select('id, status, organization_id')
    .eq('id', rideId)
    .eq('driver_id', context.driverId)
    .maybeSingle();
  if (!ride) return err(new NotFoundError('Deze rit staat niet op jouw naam.'));

  const check = checkTransition(ride.status, 'CLIENT_ABSENT', {
    checkoutMode: context.checkoutMode,
    hasCheckoutEvent: false,
  });
  if (!check.allowed) {
    return err(
      new StateTransitionError(
        'Afwezigheid kun je pas melden als je bij de cliënt bent aangekomen.',
      ),
    );
  }

  const { error } = await supabase
    .from('rides')
    .update({ status: 'CLIENT_ABSENT', absence_reason: reason })
    .eq('id', rideId)
    .eq('driver_id', context.driverId);
  if (error)
    return err(new StateTransitionError('De melding kon niet worden opgeslagen.'));

  await supabase.from('ride_events').insert({
    organization_id: ride.organization_id,
    ride_id: rideId,
    event_type: 'CLIENT_ABSENT',
    actor_user_id: context.userId,
    actor_kind: 'DRIVER',
    source: 'MANUAL',
    metadata: { reason: reason ?? 'OTHER', ...(note ? { note } : {}) },
    ...(gps && context.gpsEnabled
      ? { latitude: gps.latitude, longitude: gps.longitude, accuracy_m: gps.accuracy }
      : {}),
  });

  return ok(null);
}

export async function reportProblem(
  context: DriverContext,
  rideId: string,
  note: string,
): Promise<Result<null>> {
  const supabase = await createClient();

  const { data: ride } = await supabase
    .from('rides')
    .select('id, organization_id')
    .eq('id', rideId)
    .eq('driver_id', context.driverId)
    .maybeSingle();
  if (!ride) return err(new NotFoundError('Deze rit staat niet op jouw naam.'));

  // A problem report does NOT change the status. A driver reporting "the lift
  // is jammed" while en route must not have the ride yanked out of the flow;
  // the dispatcher decides what happens next.
  await supabase.from('ride_events').insert({
    organization_id: ride.organization_id,
    ride_id: rideId,
    event_type: 'PROBLEM_REPORTED',
    actor_user_id: context.userId,
    actor_kind: 'DRIVER',
    source: 'MANUAL',
    metadata: { note },
  });

  return ok(null);
}

export async function requireDriverContext(): Promise<DriverContext> {
  const context = await getDriverContext();
  if (!context) {
    throw new AuthorizationError('Je account is niet gekoppeld aan een chauffeur.');
  }
  return context;
}
