import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { localToInstant } from '@/lib/datetime/timezone';
import {
  ConflictError,
  NotFoundError,
  StateTransitionError,
} from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { type Page, type ResolvedListParams } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';
import { type Tables } from '@/types/database';
import * as repository from './repository';
import { type RideListItem } from './types';
import {
  checkTransition,
  RIDE_STATUS_REFUSAL_MESSAGES,
  type CheckoutMode,
  type RideStatus,
} from './status';
import {
  type AssignRideInput,
  type CancelRideInput,
  type ChangeStatusInput,
  type RideFormInput,
  type RideSort,
} from './schema';

async function organizationTimezone(organizationId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_settings')
    .select('timezone')
    .eq('organization_id', organizationId)
    .maybeSingle();
  return data?.timezone ?? 'Europe/Amsterdam';
}

async function checkoutMode(organizationId: string): Promise<CheckoutMode> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_settings')
    .select('checkout_mode')
    .eq('organization_id', organizationId)
    .maybeSingle();
  return data?.checkout_mode ?? 'OPTIONAL';
}

export async function listRidesForDate(organizationId: string, date: string) {
  await requirePermission(organizationId, 'rides.view');
  return repository.findRidesForDate(organizationId, date);
}

export async function listRides(
  organizationId: string,
  params: ResolvedListParams<RideSort>,
  filters: {
    from?: string;
    to?: string;
    status?: Tables<'rides'>['status'];
    clientId?: string;
  },
): Promise<Page<RideListItem>> {
  await requirePermission(organizationId, 'rides.view');
  return repository.findRides(organizationId, params, filters);
}

export async function getRide(organizationId: string, rideId: string) {
  await requirePermission(organizationId, 'rides.view');
  return repository.findRideById(organizationId, rideId);
}

export async function getRideEvents(organizationId: string, rideId: string) {
  await requirePermission(organizationId, 'rides.view');
  return repository.findRideEvents(rideId);
}

export async function createRide(
  organizationId: string,
  input: RideFormInput,
): Promise<Result<{ id: string }>> {
  const user = await requirePermission(organizationId, 'rides.create');
  const timeZone = await organizationTimezone(organizationId);

  const pickupAt = localToInstant(
    input.scheduledDate,
    input.scheduledPickupTime,
    timeZone,
  ).toISOString();

  const created = await repository.insertRide(organizationId, input, pickupAt);
  if (!created) return err(new ConflictError('De rit kon niet worden aangemaakt.'));

  await repository.insertRideEvent(organizationId, created.id, 'CREATED', user.id);
  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'ride.created',
    entityType: 'rides',
    entityId: created.id,
  });

  return ok(created);
}

export async function editRide(
  organizationId: string,
  rideId: string,
  input: RideFormInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'rides.update');

  const existing = await repository.findRideById(organizationId, rideId);
  if (!existing) return err(new NotFoundError('Deze rit bestaat niet.'));

  const timeZone = await organizationTimezone(organizationId);
  const pickupAt = localToInstant(
    input.scheduledDate,
    input.scheduledPickupTime,
    timeZone,
  ).toISOString();

  // A generated ride that a planner edits becomes an exception: from now on the
  // nightly generation leaves it alone (masterprompt §15).
  const wasGenerated = existing.ride_template_id !== null;

  const updated = await repository.updateRide(
    organizationId,
    rideId,
    input,
    pickupAt,
    wasGenerated,
  );
  if (!updated) return err(new ConflictError('De wijziging kon niet worden opgeslagen.'));

  await repository.insertRideEvent(organizationId, rideId, 'RESCHEDULED', user.id, {
    became_exception: wasGenerated,
  });

  return ok(null);
}

/**
 * Assigning a driver moves SCHEDULED to DRIVER_ASSIGNED; unassigning moves it
 * back. Both are legal transitions, so the state machine stays the authority
 * rather than being bypassed by a direct status write.
 */
export async function assignRide(
  organizationId: string,
  input: AssignRideInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'rides.assign_driver');

  const existing = await repository.findRideById(organizationId, input.rideId);
  if (!existing) return err(new NotFoundError('Deze rit bestaat niet.'));

  const current = existing.status;
  let nextStatus: RideStatus | null = null;

  if (input.driverId && current === 'SCHEDULED') nextStatus = 'DRIVER_ASSIGNED';
  if (!input.driverId && current === 'DRIVER_ASSIGNED') nextStatus = 'SCHEDULED';

  if (nextStatus) {
    const check = checkTransition(current, nextStatus, {
      checkoutMode: 'DISABLED',
      hasCheckoutEvent: false,
    });
    if (!check.allowed) {
      return err(new StateTransitionError(RIDE_STATUS_REFUSAL_MESSAGES[check.reason]));
    }
  }

  const assigned = await repository.assignRide(
    organizationId,
    input.rideId,
    input.driverId,
    input.vehicleId,
    nextStatus,
  );
  if (!assigned)
    return err(new ConflictError('De toewijzing kon niet worden opgeslagen.'));

  await repository.insertRideEvent(
    organizationId,
    input.rideId,
    input.driverId ? 'DRIVER_ASSIGNED' : 'DRIVER_UNASSIGNED',
    user.id,
  );

  return ok(null);
}

export async function changeRideStatus(
  organizationId: string,
  input: ChangeStatusInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'rides.dispatch');

  const existing = await repository.findRideById(organizationId, input.rideId);
  if (!existing) return err(new NotFoundError('Deze rit bestaat niet.'));

  const mode = await checkoutMode(organizationId);
  const events = await repository.findRideEvents(input.rideId);
  const hasCheckoutEvent = events.some((e) => e.event_type === 'CLIENT_CHECKED_OUT');

  // Checked here for a clear message; the database trigger checks it again so a
  // direct API call cannot bypass the workflow (masterprompt §61).
  const check = checkTransition(existing.status, input.status, {
    checkoutMode: mode,
    hasCheckoutEvent,
  });
  if (!check.allowed) {
    return err(new StateTransitionError(RIDE_STATUS_REFUSAL_MESSAGES[check.reason]));
  }

  const extra: Partial<Tables<'rides'>> = {};
  if (input.status === 'CLIENT_ABSENT' && input.absenceReason) {
    extra.absence_reason = input.absenceReason;
  }
  if (input.status === 'COMPLETED') extra.completed_at = new Date().toISOString();

  const result = await repository.setRideStatus(
    organizationId,
    input.rideId,
    input.status,
    extra,
  );
  if (!result.ok) {
    return err(
      new StateTransitionError(
        result.message?.includes('Illegal ride status transition')
          ? 'Deze statuswijziging is niet toegestaan vanuit de huidige status.'
          : 'De status kon niet worden gewijzigd.',
      ),
    );
  }

  await repository.insertRideEvent(
    organizationId,
    input.rideId,
    input.status === 'CLIENT_ABSENT' ? 'CLIENT_ABSENT' : 'RESCHEDULED',
    user.id,
    input.absenceReason ? { reason: input.absenceReason } : {},
  );

  return ok(null);
}

export async function cancelRide(
  organizationId: string,
  input: CancelRideInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'rides.cancel');

  const existing = await repository.findRideById(organizationId, input.rideId);
  if (!existing) return err(new NotFoundError('Deze rit bestaat niet.'));

  const check = checkTransition(existing.status, 'CANCELLED', {
    checkoutMode: 'DISABLED',
    hasCheckoutEvent: false,
  });
  if (!check.allowed) {
    return err(new StateTransitionError(RIDE_STATUS_REFUSAL_MESSAGES[check.reason]));
  }

  const result = await repository.setRideStatus(
    organizationId,
    input.rideId,
    'CANCELLED',
    {
      cancellation_reason: input.reason,
    },
  );
  if (!result.ok) return err(new ConflictError('De rit kon niet worden geannuleerd.'));

  await repository.insertRideEvent(organizationId, input.rideId, 'CANCELLED', user.id);
  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'ride.cancelled',
    entityType: 'rides',
    entityId: input.rideId,
  });

  return ok(null);
}
