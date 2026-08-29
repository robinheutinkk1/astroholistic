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
  careOrganizationFormSchema,
  careOrganizationLinkSchema,
  careOrganizationUnlinkSchema,
} from './schema';
import * as service from './service';

const CONTEXT = 'care organization action';
const LIST_PATH = '/opdrachtgevers';

function parseForm(formData: FormData) {
  return careOrganizationFormSchema.safeParse({
    name: formData.get('name'),
    contactEmail: formData.get('contactEmail'),
    phone: formData.get('phone'),
    addressLine1: formData.get('addressLine1'),
    postalCode: formData.get('postalCode'),
    city: formData.get('city'),
    externalReference: formData.get('externalReference'),
    status: formData.get('status'),
  });
}

export async function createCareOrganizationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = parseForm(formData);
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  let createdId: string;
  try {
    const result = await service.createCareOrganization(
      membership.organizationId,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
    createdId = result.data.id;
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}/${createdId}` as Route);
}

export async function updateCareOrganizationAction(
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
    const result = await service.editCareOrganization(
      membership.organizationId,
      id,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  return { status: 'success', message: 'De wijzigingen zijn opgeslagen.' };
}

export async function deleteCareOrganizationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await service.removeCareOrganization(membership.organizationId, id);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH as Route);
}

export async function linkClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = careOrganizationLinkSchema.safeParse({
    clientId: formData.get('clientId'),
    careOrganizationId: formData.get('careOrganizationId'),
    validFrom: formData.get('validFrom'),
    validTo: formData.get('validTo'),
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await service.linkClient(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(`/clienten/${parsed.data.clientId}`);
  revalidatePath(`${LIST_PATH}/${parsed.data.careOrganizationId}`);
  return {
    status: 'success',
    message:
      'De cliënt is gekoppeld. De zorgorganisatie ziet vanaf de begindatum de ritten van deze cliënt.',
  };
}

export async function unlinkClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = careOrganizationUnlinkSchema.safeParse({
    clientId: formData.get('clientId'),
    careOrganizationId: formData.get('careOrganizationId'),
    validFrom: formData.get('validFrom'),
  });
  if (!parsed.success) return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await service.unlinkClient(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(`/clienten/${parsed.data.clientId}`);
  revalidatePath(`${LIST_PATH}/${parsed.data.careOrganizationId}`);
  return {
    status: 'success',
    message: 'De koppeling is weg. De zorgorganisatie ziet deze cliënt niet meer.',
  };
}
