'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/features/rbac/session';
import { consumeForUser } from '@/lib/security/rate-limit';
import { z } from 'zod';
import { getActiveMembership } from '@/features/organizations/active-organization';
import {
  fromValidationIssues,
  toFormState,
  type FormState,
} from '@/lib/errors/form-state';
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
