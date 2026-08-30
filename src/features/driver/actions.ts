'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  fromValidationIssues,
  toFormState,
  type FormState,
} from '@/lib/errors/form-state';
import {
  requireDriverContext,
  performDriverAction,
  reportAbsence,
  reportProblem,
} from './service';
import { markStopArrived } from './trips';
import { clampOccurredAt } from './occurred-at';

const CONTEXT = 'driver action';

/**
 * GPS arrives from the browser as form fields, so it is untrusted input like
 * anything else: validated, and silently dropped if malformed rather than
 * failing the action. A driver pressing "arrived" must never be blocked by a
 * bad coordinate.
 */
const gpsSchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    accuracy: z.coerce.number().min(0).nullable().catch(null),
  })
  .nullable()
  .catch(null);

/**
 * Het moment van de klik, meegegeven door de browser. Aanwezig omdat een
 * handeling uit de offline-wachtrij later binnenkomt dan hij gebeurde; geklemd
 * omdat het invoer van een toestel is (zie occurred-at.ts).
 */
function parseOccurredAt(formData: FormData): Date {
  return clampOccurredAt(formData.get('occurredAt'));
}

function parseGps(formData: FormData) {
  const latitude = formData.get('latitude');
  const longitude = formData.get('longitude');
  if (!latitude || !longitude) return null;

  const parsed = gpsSchema.safeParse({
    latitude,
    longitude,
    accuracy: formData.get('accuracy'),
  });
  return parsed.success ? parsed.data : null;
}

export async function driverActionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const rideId = formData.get('rideId');
  const action = formData.get('action');
  if (typeof rideId !== 'string' || typeof action !== 'string') {
    return { status: 'error', message: 'Ongeldige aanvraag.' };
  }

  try {
    const context = await requireDriverContext();
    const result = await performDriverAction(
      context,
      rideId,
      action,
      parseGps(formData),
      'MANUAL',
      parseOccurredAt(formData),
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/driver');
  revalidatePath(`/driver/rit/${rideId}`);
  return { status: 'success' };
}

const absenceSchema = z.object({
  rideId: z.uuid(),
  reason: z.enum(['NOT_HOME', 'CANCELLED_BY_CLIENT', 'ILL', 'NO_ACCESS', 'OTHER']),
  note: z
    .string()
    .max(300, 'Die toelichting is te lang.')
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null),
});

export async function reportAbsenceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = absenceSchema.safeParse({
    rideId: formData.get('rideId'),
    reason: formData.get('reason'),
    note: formData.get('note'),
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const context = await requireDriverContext();
    const result = await reportAbsence(
      context,
      parsed.data.rideId,
      parsed.data.reason,
      parsed.data.note,
      parseGps(formData),
      parseOccurredAt(formData),
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/driver');
  revalidatePath(`/driver/rit/${parsed.data.rideId}`);
  return { status: 'success', message: 'Doorgegeven aan de planning.' };
}

const problemSchema = z.object({
  rideId: z.uuid(),
  note: z
    .string()
    .min(1, 'Beschrijf kort wat er aan de hand is.')
    .max(500, 'Die melding is te lang.')
    .transform((value) => value.trim()),
});

export async function reportProblemAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = problemSchema.safeParse({
    rideId: formData.get('rideId'),
    note: formData.get('note'),
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const context = await requireDriverContext();
    const result = await reportProblem(
      context,
      parsed.data.rideId,
      parsed.data.note,
      parseOccurredAt(formData),
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(`/driver/rit/${parsed.data.rideId}`);
  return { status: 'success', message: 'De planning is op de hoogte.' };
}

export async function markStopArrivedAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const stopId = formData.get('stopId');
  const tripId = formData.get('tripId');
  if (typeof stopId !== 'string') {
    return { status: 'error', message: 'Ongeldige aanvraag.' };
  }

  try {
    const context = await requireDriverContext();
    const marked = await markStopArrived(context, stopId, parseOccurredAt(formData));
    if (!marked) {
      return { status: 'error', message: 'Deze stop is al afgemeld of niet van jou.' };
    }
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/driver');
  if (typeof tripId === 'string') revalidatePath(`/driver/groepsrit/${tripId}`);
  return { status: 'success' };
}
