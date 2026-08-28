'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getActiveMembership } from '@/features/organizations/active-organization';
import {
  fromValidationIssues,
  toFormState,
  type FormState,
} from '@/lib/errors/form-state';
import { isPlausibleToken, normalizeToken } from './token';
import * as tagService from './service';

const CONTEXT = 'tag action';

export interface CreateTagState extends FormState {
  /** Shown exactly once; the token is never stored, only its hash. */
  readonly created?: { publicCode: string; token: string; id: string };
}

export async function createTagAction(
  _previous: CreateTagState,
  formData: FormData,
): Promise<CreateTagState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const label = formData.get('label');
  const parsed = z
    .string()
    .max(80, 'Die omschrijving is te lang.')
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .safeParse(typeof label === 'string' ? label : null);

  if (!parsed.success) {
    return { status: 'error', message: 'Die omschrijving is te lang.' };
  }

  try {
    const result = await tagService.createTag(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);

    revalidatePath('/tags');
    return {
      status: 'success',
      message:
        'Tag aangemaakt. Schrijf hem nu; de code is hierna niet meer op te vragen.',
      created: result.data,
    };
  } catch (error) {
    return toFormState(error, CONTEXT);
  }
}

const assignSchema = z.object({ tagId: z.uuid(), clientId: z.uuid('Kies een cliënt.') });

export async function assignTagAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = assignSchema.safeParse({
    tagId: formData.get('tagId'),
    clientId: formData.get('clientId'),
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await tagService.assignTag(
      membership.organizationId,
      parsed.data.tagId,
      parsed.data.clientId,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/tags');
  return { status: 'success', message: 'De tag is gekoppeld.' };
}

export async function unassignTagAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const tagId = formData.get('tagId') ?? formData.get('id');
  if (typeof tagId !== 'string')
    return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const reason = formData.get('reason');
    const result = await tagService.unassignTag(
      membership.organizationId,
      tagId,
      typeof reason === 'string' && reason.trim() ? reason.trim() : null,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/tags');
  return { status: 'success', message: 'De tag is losgekoppeld.' };
}

const statusSchema = z.object({
  tagId: z.uuid(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOST']),
});

export async function setTagStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = statusSchema.safeParse({
    tagId: formData.get('tagId'),
    status: formData.get('status'),
  });
  if (!parsed.success) return { status: 'error', message: 'Ongeldige aanvraag.' };

  try {
    const result = await tagService.setTagStatus(
      membership.organizationId,
      parsed.data.tagId,
      parsed.data.status,
    );
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/tags');
  return {
    status: 'success',
    message:
      parsed.data.status === 'LOST'
        ? 'Als verloren gemarkeerd en direct losgekoppeld.'
        : 'De status is gewijzigd.',
  };
}

export interface CheckinState extends FormState {
  readonly outcome?: tagService.CheckinOutcome;
  readonly clientName?: string | null;
  readonly occurredAt?: string | null;
}

/**
 * Handles a scan. The heavy lifting is a single database function; this only
 * turns the outcome into something a driver reads at a door.
 */
export async function checkinAction(
  _previous: CheckinState,
  formData: FormData,
): Promise<CheckinState> {
  const raw = formData.get('token');
  const sourceRaw = formData.get('source');
  const source = sourceRaw === 'QR' ? 'QR' : 'NFC';

  // Rejected before any database work: a probe should not cost a query.
  if (typeof raw !== 'string' || !isPlausibleToken(raw)) {
    return {
      status: 'error',
      outcome: 'UNKNOWN_TAG',
      message: 'Deze tag is niet bekend.',
    };
  }

  try {
    const result = await tagService.checkinByToken(normalizeToken(raw), source);
    return {
      status: result.outcome === 'CHECKED_IN' ? 'success' : 'error',
      ...toState(result),
    };
  } catch (error) {
    return toFormState(error, CONTEXT);
  }
}

function toState(result: tagService.CheckinResult): Omit<CheckinState, 'status'> {
  const time = result.occurredAt
    ? new Intl.DateTimeFormat('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Amsterdam',
      }).format(new Date(result.occurredAt))
    : null;

  const messages: Record<tagService.CheckinOutcome, string> = {
    CHECKED_IN: `${result.clientName ?? 'Cliënt'} ingecheckt om ${time}.`,
    ALREADY_CHECKED_IN: `${result.clientName ?? 'Cliënt'} is al ingecheckt om ${time}.`,
    NO_ACTIVE_RIDE: 'Geen actieve rit gevonden voor deze tag vandaag.',
    NO_ACCESS: 'Geen toegang.',
    UNKNOWN_TAG: 'Deze tag is niet bekend.',
    NOT_ALLOWED: 'Log in om verder te gaan.',
    RATE_LIMITED: 'Te veel pogingen. Wacht even en probeer opnieuw.',
  };

  return {
    outcome: result.outcome,
    message: messages[result.outcome],
    clientName: result.clientName,
    occurredAt: result.occurredAt,
  };
}
