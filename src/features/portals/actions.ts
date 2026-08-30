'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/features/rbac/session';
import { consume, consumeForUser } from '@/lib/security/rate-limit';
import { z } from 'zod';
import { getActiveMembership } from '@/features/organizations/active-organization';
import {
  fromValidationIssues,
  toFormState,
  type FormState,
} from '@/lib/errors/form-state';
import * as grants from './grants';
import * as portalService from './service';
import * as reviewService from './review';

const CONTEXT = 'portal action';

const requestSchema = z.object({
  clientId: z.uuid(),
  rideId: z
    .union([z.literal(''), z.uuid()])
    .transform((value) => (value === '' ? null : value))
    .nullable(),
  kind: z.enum(['ABSENCE', 'TIME_CHANGE', 'DESTINATION_CHANGE', 'CANCEL', 'OTHER']),
  note: z
    .string()
    .max(500, 'Die toelichting is te lang.')
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null),
  // Alleen gevuld bij een periode-afmelding; de inhoudelijke controle (volgorde,
  // verleden, horizon) gebeurt in de service tegen de tijdzone van de organisatie.
  from: z
    .string()
    .max(10)
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null),
  to: z
    .string()
    .max(10)
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null),
});

export async function submitRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = requestSchema.safeParse({
    clientId: formData.get('clientId'),
    rideId: formData.get('rideId') ?? '',
    kind: formData.get('kind'),
    note: formData.get('note'),
    from: formData.get('from') ?? '',
    to: formData.get('to') ?? '',
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  // Keyed on the user, not the address: a parent and a care co-ordinator often
  // sit behind the same office NAT, and one of them filing absences should not
  // silence the other.
  const user = await requireUser();
  if (!(await consumeForUser('portal-write', user.id))) {
    return {
      status: 'error',
      message:
        'Er zijn in korte tijd veel verzoeken vanaf dit account verstuurd. Probeer het later opnieuw of bel de vervoerder.',
    };
  }

  try {
    const result = await portalService.submitRequest(parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/portaal');
  revalidatePath(`/portaal/${parsed.data.clientId}`);
  return {
    status: 'success',
    message:
      parsed.data.kind === 'ABSENCE'
        ? 'De afmelding is doorgegeven. De planning bevestigt hem.'
        : 'Je verzoek is verstuurd. De planning kijkt ernaar.',
  };
}

const reviewSchema = z.object({
  requestId: z.uuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z
    .string()
    .max(300, 'Die toelichting is te lang.')
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null),
});

export async function reviewRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = reviewSchema.safeParse({
    requestId: formData.get('requestId'),
    decision: formData.get('decision'),
    note: formData.get('note'),
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await reviewService.reviewRequest(
      membership.organizationId,
      parsed.data.requestId,
      parsed.data.decision,
      parsed.data.note,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/verzoeken');
  return {
    status: 'success',
    message:
      parsed.data.decision === 'APPROVED'
        ? 'Goedgekeurd. Pas de rit nu zelf aan; de aanvrager ziet de status.'
        : 'Afgewezen. De aanvrager ziet je toelichting.',
  };
}

/*
 * Portaaltoegang uitdelen en intrekken.
 *
 * Deze twee horen bij de beheerkant en niet bij het portaal zelf, maar ze staan
 * hier omdat ze over dezelfde toegang gaan: één plek om te lezen wie het
 * portaal in mag en waarom.
 */

export async function grantPortalAccessAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = grants.portalAccessSchema.safeParse({
    kind: formData.get('kind'),
    subjectId: formData.get('subjectId'),
    email: formData.get('email'),
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  // Dezelfde emmer als het uitnodigen van medewerkers: het gaat om hetzelfde
  // risico, namelijk post sturen naar een adres dat iemand anders toebehoort.
  if (!(await consume('member-invite', membership.organizationId))) {
    return {
      status: 'error',
      message:
        'Er zijn kort achter elkaar veel uitnodigingen verstuurd. Probeer het over een uur opnieuw.',
    };
  }

  try {
    const result = await grants.grantPortalAccess(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);

    revalidatePath('/clienten');
    return {
      status: 'success',
      message: result.data.invited
        ? `Er is een uitnodiging gestuurd naar ${parsed.data.email}. Zodra het wachtwoord is ingesteld, werkt de toegang.`
        : `${parsed.data.email} had al een account en kan meteen inloggen. Er is geen mail verstuurd.`,
    };
  } catch (error) {
    return toFormState(error, CONTEXT);
  }
}

export async function revokePortalAccessAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = grants.portalRevokeSchema.safeParse({
    kind: formData.get('kind'),
    subjectId: formData.get('subjectId'),
  });
  if (!parsed.success) return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await grants.revokePortalAccess(
      membership.organizationId,
      parsed.data,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/clienten');
  return {
    status: 'success',
    message: 'De toegang is ingetrokken. Er is per direct niets meer te zien.',
  };
}

/**
 * Eén medewerker van een zorgorganisatie zijn toegang afnemen.
 *
 * Apart van revokePortalAccessAction, omdat een zorgorganisatie meerdere
 * mensen kan hebben: "de toegang van De Brug intrekken" bestaat niet, alleen
 * "Marieke van De Brug".
 */
export async function revokeCareOrgPortalUserAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = z
    .object({ careOrganizationId: z.uuid(), membershipId: z.uuid() })
    .safeParse({
      careOrganizationId: formData.get('careOrganizationId'),
      membershipId: formData.get('membershipId'),
    });
  if (!parsed.success) return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await grants.revokeCareOrgPortalUser(
      membership.organizationId,
      parsed.data.careOrganizationId,
      parsed.data.membershipId,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath(`/opdrachtgevers/${parsed.data.careOrganizationId}`);
  return {
    status: 'success',
    message: 'De toegang is ingetrokken. Deze medewerker ziet per direct niets meer.',
  };
}
