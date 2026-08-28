'use server';

import { revalidatePath } from 'next/cache';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { toFormState, type FormState } from '@/lib/errors/form-state';
import { setMemberStatusSchema, updateMemberRolesSchema } from './schema';
import * as memberService from './service';

export async function updateMemberRolesAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = updateMemberRolesSchema.safeParse({
    membershipId: formData.get('membershipId'),
    roleIds: formData.getAll('roleIds'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Een lid moet minimaal één rol houden.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await memberService.updateMemberRoles(
      membership.organizationId,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, 'member action');
  } catch (error) {
    return toFormState(error, 'member action');
  }

  revalidatePath('/instellingen/gebruikers');
  return { status: 'success', message: 'De rollen zijn bijgewerkt.' };
}

export async function setMemberStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = setMemberStatusSchema.safeParse({
    membershipId: formData.get('membershipId'),
    status: formData.get('status'),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Ongeldige aanvraag.' };
  }

  try {
    const result = await memberService.setMemberStatus(
      membership.organizationId,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, 'member action');
  } catch (error) {
    return toFormState(error, 'member action');
  }

  revalidatePath('/instellingen/gebruikers');
  return {
    status: 'success',
    message:
      parsed.data.status === 'SUSPENDED'
        ? 'Het lid is geschorst en heeft direct geen toegang meer.'
        : 'Het lid is weer actief.',
  };
}
