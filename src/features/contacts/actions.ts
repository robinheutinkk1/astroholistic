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
import { contactFormSchema, contactLinkSchema, contactUnlinkSchema } from './schema';
import * as service from './service';

const CONTEXT = 'contact action';
const LIST_PATH = '/contactpersonen';

function parseForm(formData: FormData) {
  return contactFormSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    status: formData.get('status'),
  });
}

export async function createContactAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = parseForm(formData);
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  let createdId: string;
  try {
    const result = await service.createContact(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
    createdId = result.data.id;
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}/${createdId}` as Route);
}

export async function updateContactAction(
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
    const result = await service.editContact(membership.organizationId, id, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  return { status: 'success', message: 'De wijzigingen zijn opgeslagen.' };
}

export async function deleteContactAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await service.removeContact(membership.organizationId, id);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH as Route);
}

/**
 * Een contactpersoon aan een cliënt hangen, met de afspraken erbij.
 *
 * Checkboxen die niet zijn aangevinkt komen niet in de FormData voor. Daarom
 * leest dit `formData.get(...) !== null` en niet de waarde: een ontbrekend
 * vinkje is "nee", en dat moet het ook worden als het vinkje eerst wél aan
 * stond.
 */
export async function linkContactAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = contactLinkSchema.safeParse({
    clientId: formData.get('clientId'),
    contactId: formData.get('contactId'),
    relationship: formData.get('relationship'),
    isPrimary: formData.get('isPrimary') !== null,
    canViewRides: formData.get('canViewRides') !== null,
    canReportAbsence: formData.get('canReportAbsence') !== null,
    canRequestChanges: formData.get('canRequestChanges') !== null,
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await service.linkContact(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(`/clienten/${parsed.data.clientId}`);
  revalidatePath(`${LIST_PATH}/${parsed.data.contactId}`);
  return { status: 'success', message: 'De koppeling is opgeslagen.' };
}

export async function unlinkContactAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = contactUnlinkSchema.safeParse({
    clientId: formData.get('clientId'),
    contactId: formData.get('contactId'),
  });
  if (!parsed.success) return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await service.unlinkContact(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(`/clienten/${parsed.data.clientId}`);
  revalidatePath(`${LIST_PATH}/${parsed.data.contactId}`);
  return {
    status: 'success',
    message:
      'De koppeling is weg. Als deze persoon toegang tot het portaal had, ziet hij deze cliënt per direct niet meer.',
  };
}
