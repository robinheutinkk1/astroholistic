'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getActiveMembership } from '@/features/organizations/active-organization';
import {
  fromValidationIssues,
  toFormState,
  type FormState,
} from '@/lib/errors/form-state';
import {
  assignRideSchema,
  cancelRideSchema,
  changeStatusSchema,
  rideFormSchema,
} from './schema';
import * as rideService from './service';

const CONTEXT = 'ride action';

function parseRideForm(formData: FormData) {
  return rideFormSchema.safeParse({
    clientId: formData.get('clientId'),
    pickupLocationId: formData.get('pickupLocationId'),
    destinationLocationId: formData.get('destinationLocationId'),
    scheduledDate: formData.get('scheduledDate'),
    scheduledPickupTime: formData.get('scheduledPickupTime'),
    driverId: formData.get('driverId'),
    vehicleId: formData.get('vehicleId'),
    transportRequirements: formData.getAll('transportRequirements'),
    notes: formData.get('notes'),
  });
}

export async function createRideAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = parseRideForm(formData);
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  let rideId: string;
  try {
    const result = await rideService.createRide(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
    rideId = result.data.id;
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/planning');
  revalidatePath('/ritten');
  redirect(`/ritten/${rideId}` as Route);
}

export async function updateRideAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const rideId = formData.get('rideId');
  if (typeof rideId !== 'string')
    return { status: 'error', message: 'Ongeldige aanvraag.' };

  const parsed = parseRideForm(formData);
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await rideService.editRide(
      membership.organizationId,
      rideId,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/planning');
  revalidatePath(`/ritten/${rideId}`);
  return {
    status: 'success',
    message:
      'De rit is opgeslagen. Deze rit wijkt nu af van de terugkerende afspraak en wordt niet meer automatisch bijgewerkt.',
  };
}

export async function assignRideAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = assignRideSchema.safeParse({
    rideId: formData.get('rideId'),
    driverId: formData.get('driverId'),
    vehicleId: formData.get('vehicleId'),
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await rideService.assignRide(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/planning');
  revalidatePath(`/ritten/${parsed.data.rideId}`);
  return { status: 'success', message: 'De toewijzing is opgeslagen.' };
}

export async function changeRideStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = changeStatusSchema.safeParse({
    rideId: formData.get('rideId'),
    status: formData.get('status'),
    absenceReason: formData.get('absenceReason') || undefined,
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await rideService.changeRideStatus(
      membership.organizationId,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/planning');
  revalidatePath(`/ritten/${parsed.data.rideId}`);
  return { status: 'success', message: 'De status is bijgewerkt.' };
}

export async function cancelRideAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = cancelRideSchema.safeParse({
    rideId: formData.get('rideId') ?? formData.get('id'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await rideService.cancelRide(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/planning');
  revalidatePath(`/ritten/${parsed.data.rideId}`);
  return { status: 'success', message: 'De rit is geannuleerd.' };
}
