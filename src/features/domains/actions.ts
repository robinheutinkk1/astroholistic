'use server';

import { revalidatePath } from 'next/cache';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { toFormState, type FormState } from '@/lib/errors/form-state';
import * as service from './service';

const CONTEXT = 'domain action';
const PATH = '/instellingen/domeinen';

const VERIFY_MESSAGES: Record<service.VerifyResult['status'], FormState> = {
  VERIFIED: { status: 'success', message: 'De domeinnaam is geverifieerd.' },
  NO_RECORD: {
    status: 'error',
    message:
      'We vonden nog geen TXT-record. Het kan tot 24 uur duren voordat een DNS-wijziging overal zichtbaar is.',
  },
  TOKEN_MISMATCH: {
    status: 'error',
    message:
      'Er staat wel een TXT-record, maar met een andere waarde. Controleer of u de hele regel heeft overgenomen.',
  },
  TAKEN: {
    status: 'error',
    message: 'Deze domeinnaam is al door een andere organisatie geverifieerd.',
  },
};

export async function addDomainAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const hostname = formData.get('hostname');
  if (typeof hostname !== 'string') {
    return { status: 'error', message: 'Ongeldige aanvraag.' };
  }

  try {
    const result = await service.addDomain(membership.organizationId, hostname);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(PATH);
  return {
    status: 'success',
    message: 'De domeinnaam is toegevoegd. Publiceer het TXT-record en verifieer daarna.',
  };
}

export async function verifyDomainAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await service.verifyDomain(membership.organizationId, id);
    if (!result.ok) return toFormState(result.error, CONTEXT);
    revalidatePath(PATH);
    return VERIFY_MESSAGES[result.data.status];
  } catch (error) {
    return toFormState(error, CONTEXT);
  }
}

export async function removeDomainAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await service.removeDomain(membership.organizationId, id);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(PATH);
  return { status: 'success', message: 'De domeinnaam is verwijderd.' };
}

export async function makePrimaryDomainAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const id = formData.get('id');
  if (typeof id !== 'string') return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await service.makePrimary(membership.organizationId, id);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(PATH);
  return { status: 'success', message: 'Het hoofddomein is gewijzigd.' };
}
