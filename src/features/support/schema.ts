import { z } from 'zod';

/**
 * Granting platform support a look inside.
 *
 * The reason is required and stored, not because it is validated — nobody
 * checks that "ticket 1234" exists — but because it is what the organisation
 * reads back in six months when they ask themselves why an outsider had access
 * that week.
 */
export const SUPPORT_SCOPES = ['OPERATIONAL', 'PERSONAL'] as const;
export type SupportScope = (typeof SUPPORT_SCOPES)[number];

export const SUPPORT_SCOPE_LABELS: Record<SupportScope, string> = {
  OPERATIONAL: 'Alleen ritten en instellingen',
  PERSONAL: 'Ook cliënt- en contactgegevens',
};

export const SUPPORT_SCOPE_DESCRIPTIONS: Record<SupportScope, string> = {
  OPERATIONAL:
    'Ritten, ritgebeurtenissen, chauffeurs, voertuigen, locaties en instellingen. Geen namen of adressen van cliënten.',
  PERSONAL:
    'Alles hierboven, plus de gegevens van cliënten en contactpersonen. Kies dit alleen als de vraag daar echt over gaat.',
};

/**
 * Duration, not an end date.
 *
 * A date picker invites "31 december" and the grant is then open for months.
 * A short list of durations makes the shortest one the easy answer, which is
 * the behaviour worth designing for.
 */
export const SUPPORT_DURATIONS = [2, 8, 24, 72] as const;
export type SupportDuration = (typeof SUPPORT_DURATIONS)[number];

export const SUPPORT_DURATION_LABELS: Record<SupportDuration, string> = {
  2: '2 uur',
  8: '8 uur',
  24: '1 dag',
  72: '3 dagen',
};

export const grantSupportSchema = z.object({
  grantedToUserId: z.uuid('Kies een medewerker van het platform.'),
  reason: z
    .string()
    .min(5, 'Beschrijf kort waarom deze toegang nodig is.')
    .max(200, 'Die toelichting is te lang.')
    .transform((value) => value.trim()),
  scope: z.enum(SUPPORT_SCOPES).catch('OPERATIONAL'),
  durationHours: z.coerce
    .number()
    .refine(
      (value): value is SupportDuration =>
        (SUPPORT_DURATIONS as readonly number[]).includes(value),
      'Kies een geldige duur.',
    ),
});

export type GrantSupportInput = z.infer<typeof grantSupportSchema>;

/**
 * Retention.
 *
 * Automatic anonymisation is off by default and stays off until an
 * organisation switches it on. A product that silently starts erasing a
 * customer's data on a schedule they never chose has made their decision for
 * them, and it is not a decision that can be taken back.
 */
export const retentionSchema = z.object({
  inactiveClientMonths: z.coerce
    .number()
    .int()
    .min(6, 'Kies minimaal 6 maanden.')
    .max(120, 'Kies maximaal 120 maanden.'),
  autoAnonymizeEnabled: z
    .union([z.literal('on'), z.literal('true'), z.literal(''), z.null(), z.undefined()])
    .transform((value) => value === 'on' || value === 'true'),
});

export type RetentionInput = z.infer<typeof retentionSchema>;
