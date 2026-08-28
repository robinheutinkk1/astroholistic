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
import { vehicleFormSchema } from './schema';
import * as service from './service';

const CONTEXT = 'vehicle action';
const LIST_PATH = '/voertuigen';

function parseForm(formData: FormData) {
  return vehicleFormSchema.safeParse({
    licensePlate: formData.get('licensePlate'),
    make: formData.get('make'),
    model: formData.get('model'),
    vehicleType: formData.get('vehicleType'),
    seats: formData.get('seats'),
    wheelchairPositions: formData.get('wheelchairPositions'),
    status: formData.get('status'),
  });
}

export async function createVehicleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = parseForm(formData);
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  let createdId: string;
  try {
    const result = await service.createVehicle(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
    createdId = result.data.id;
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}/${createdId}` as Route);
}

export async function updateVehicleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  const parsed = parseForm(formData);
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await service.editVehicle(membership.organizationId, id, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  return { status: 'success', message: 'De wijzigingen zijn opgeslagen.' };
}

export async function deleteVehicleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await service.removeVehicle(membership.organizationId, id);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH as Route);
}
