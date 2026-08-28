'use server';

import { revalidatePath } from 'next/cache';
import { getActiveMembership } from '@/features/organizations/active-organization';
import {
  fromValidationIssues,
  toFormState,
  type FormState,
} from '@/lib/errors/form-state';
import { grantSupportSchema, retentionSchema } from './schema';
import * as service from './service';

const CONTEXT = 'support access action';
const PATH = '/instellingen/support';

export async function grantSupportAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = grantSupportSchema.safeParse({
    grantedToUserId: formData.get('grantedToUserId'),
    reason: formData.get('reason'),
    scope: formData.get('scope'),
    durationHours: formData.get('durationHours'),
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await service.grantSupportAccess(
      membership.organizationId,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(PATH);
  return { status: 'success', message: 'De toegang is verleend en loopt vanzelf af.' };
}

export async function revokeSupportAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await service.revokeSupportAccess(membership.organizationId, id);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(PATH);
  return { status: 'success', message: 'De toegang is ingetrokken.' };
}

export async function updateRetentionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = retentionSchema.safeParse({
    inactiveClientMonths: formData.get('inactiveClientMonths'),
    autoAnonymizeEnabled: formData.get('autoAnonymizeEnabled'),
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await service.updateRetention(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(PATH);
  return { status: 'success', message: 'De bewaartermijn is opgeslagen.' };
}
