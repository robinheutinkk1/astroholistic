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
import { rideTemplateFormSchema } from './schema';
import * as templateService from './service';

const CONTEXT = 'ride template action';

function parseForm(formData: FormData) {
  return rideTemplateFormSchema.safeParse({
    clientId: formData.get('clientId'),
    name: formData.get('name'),
    pickupLocationId: formData.get('pickupLocationId'),
    destinationLocationId: formData.get('destinationLocationId'),
    departureTime: formData.get('departureTime'),
    daysOfWeek: formData.getAll('daysOfWeek'),
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn'),
    defaultDriverId: formData.get('defaultDriverId'),
    defaultVehicleId: formData.get('defaultVehicleId'),
    transportRequirements: formData.getAll('transportRequirements'),
    status: formData.get('status'),
  });
}

export async function createTemplateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = parseForm(formData);
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  let templateId: string;
  try {
    const result = await templateService.createTemplate(
      membership.organizationId,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
    templateId = result.data.id;
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/terugkerend');
  revalidatePath('/planning');
  redirect(`/terugkerend/${templateId}` as Route);
}

export async function updateTemplateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  const parsed = parseForm(formData);
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  let generated: number;
  try {
    const result = await templateService.editTemplate(
      membership.organizationId,
      id,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
    generated = result.data.generated;
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/terugkerend');
  revalidatePath('/planning');
  return {
    status: 'success',
    message:
      generated > 0
        ? `Opgeslagen. ${generated} nieuwe ${generated === 1 ? 'rit' : 'ritten'} ingepland. Al bestaande ritten houden hun oude tijd.`
        : 'Opgeslagen. Al ingeplande ritten houden hun oude tijd.',
  };
}

export async function archiveTemplateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await templateService.archiveTemplate(membership.organizationId, id);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/terugkerend');
  redirect('/terugkerend');
}

export async function generateRidesAction(
  _previous: FormState,
  _formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  try {
    const result = await templateService.runGeneration(membership.organizationId);
    if (!result.ok) return toFormState(result.error, CONTEXT);

    revalidatePath('/planning');
    revalidatePath('/terugkerend');
    return {
      status: 'success',
      message:
        result.data.created === 0
          ? `Alles staat al ingepland tot ${result.data.horizonEnd}.`
          : `${result.data.created} ${result.data.created === 1 ? 'rit' : 'ritten'} ingepland, tot ${result.data.horizonEnd}.`,
    };
  } catch (error) {
    return toFormState(error, CONTEXT);
  }
}
