'use server';

import { revalidatePath } from 'next/cache';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { toFormState, type FormState } from '@/lib/errors/form-state';
import * as service from './service';

const CONTEXT = 'gdpr action';

export async function eraseClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await service.eraseClient(membership.organizationId, id);
    if (!result.ok) return toFormState(result.error, CONTEXT);

    revalidatePath('/clienten');
    revalidatePath(`/clienten/${id}`);
    return {
      status: 'success',
      message:
        result.data.contactsAnonymized > 0
          ? `De persoonsgegevens zijn gewist. Ook ${result.data.contactsAnonymized} contactpersoon(en) zonder andere koppeling zijn gewist.`
          : 'De persoonsgegevens zijn gewist. De ritten blijven als vervoersadministratie bestaan.',
    };
  } catch (error) {
    return toFormState(error, CONTEXT);
  }
}
