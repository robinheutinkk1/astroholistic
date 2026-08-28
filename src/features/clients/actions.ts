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
import { clientFormSchema } from './schema';
import * as clientService from './service';

function parseForm(formData: FormData) {
  return clientFormSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    addressLine1: formData.get('addressLine1'),
    postalCode: formData.get('postalCode'),
    city: formData.get('city'),
    externalReference: formData.get('externalReference'),
    status: formData.get('status'),
  });
}

export async function createClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return fromValidationIssues(parsed.error.flatten().fieldErrors);
  }

  let createdId: string;
  try {
    const result = await clientService.createClient(
      membership.organizationId,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, 'client action');
    createdId = result.data.id;
  } catch (error) {
    return toFormState(error, 'client action');
  }

  revalidatePath('/clienten');
  redirect(`/clienten/${createdId}` as Route);
}

export async function updateClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const clientId = formData.get('clientId');
  if (typeof clientId !== 'string') {
    return { status: 'error', message: 'Ongeldige aanvraag.' };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return fromValidationIssues(parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await clientService.editClient(
      membership.organizationId,
      clientId,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, 'client action');
  } catch (error) {
    return toFormState(error, 'client action');
  }

  revalidatePath('/clienten');
  revalidatePath(`/clienten/${clientId}`);
  return { status: 'success', message: 'De cliënt is opgeslagen.' };
}

export async function deleteClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const clientId = formData.get('clientId');
  if (typeof clientId !== 'string') {
    return { status: 'error', message: 'Ongeldige aanvraag.' };
  }

  try {
    const result = await clientService.removeClient(membership.organizationId, clientId);
    if (!result.ok) return toFormState(result.error, 'client action');
  } catch (error) {
    return toFormState(error, 'client action');
  }

  revalidatePath('/clienten');
  redirect('/clienten');
}
