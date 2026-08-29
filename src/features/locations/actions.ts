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
import { locationFormSchema } from './schema';
import * as service from './service';

const CONTEXT = 'location action';
const LIST_PATH = '/locaties';

function parseForm(formData: FormData) {
  return locationFormSchema.safeParse({
    name: formData.get('name'),
    kind: formData.get('kind'),
    addressLine1: formData.get('addressLine1'),
    postalCode: formData.get('postalCode'),
    city: formData.get('city'),
    accessNotes: formData.get('accessNotes'),
    status: formData.get('status'),
    careOrganizationId: formData.get('careOrganizationId'),
  });
}

export async function createLocationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = parseForm(formData);
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  let createdId: string;
  try {
    const result = await service.createLocation(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
    createdId = result.data.id;
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}/${createdId}` as Route);
}

export async function updateLocationAction(
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
    const result = await service.editLocation(membership.organizationId, id, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  return { status: 'success', message: 'De wijzigingen zijn opgeslagen.' };
}

export async function deleteLocationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await service.removeLocation(membership.organizationId, id);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH as Route);
}
