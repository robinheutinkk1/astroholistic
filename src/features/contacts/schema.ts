import { z } from 'zod';

const optionalText = (max: number, message: string) =>
  z
    .string()
    .max(max, message)
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null);

/**
 * Een contactpersoon is iemand die voor een cliënt regelt: een ouder, een
 * mentor, een begeleider. Wat hij mág staat niet hier maar op de koppeling met
 * de cliënt — dezelfde moeder mag voor haar zoon een afwezigheid doorgeven en
 * voor haar dochter alleen meekijken.
 */
export const contactFormSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Vul een voornaam in.')
    .max(80, 'Die voornaam is te lang.')
    .transform((value) => value.trim()),
  lastName: z
    .string()
    .min(1, 'Vul een achternaam in.')
    .max(80, 'Die achternaam is te lang.')
    .transform((value) => value.trim()),
  phone: optionalText(30, 'Dat telefoonnummer is te lang.'),
  email: z
    .union([
      z.literal(''),
      z.string().email('Dat lijkt geen geldig e-mailadres.').max(160),
    ])
    .transform((value) => (value === '' ? null : value.trim().toLowerCase()))
    .nullable()
    .catch(null),
  status: z.enum(['ACTIVE', 'INACTIVE']).catch('ACTIVE'),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

/**
 * De koppeling tussen een contactpersoon en een cliënt.
 *
 * De drie vinkjes zijn geen rollen maar afspraken per cliënt, en ze staan
 * bewust los van elkaar: meekijken is iets anders dan afmelden, en afmelden is
 * iets anders dan een rit willen verzetten.
 */
export const contactLinkSchema = z.object({
  clientId: z.uuid(),
  contactId: z.uuid(),
  relationship: optionalText(60, 'Die omschrijving is te lang.'),
  isPrimary: z.coerce.boolean().catch(false),
  canViewRides: z.coerce.boolean().catch(false),
  canReportAbsence: z.coerce.boolean().catch(false),
  canRequestChanges: z.coerce.boolean().catch(false),
});

export type ContactLinkInput = z.infer<typeof contactLinkSchema>;

export const contactUnlinkSchema = z.object({
  clientId: z.uuid(),
  contactId: z.uuid(),
});

export type ContactUnlinkInput = z.infer<typeof contactUnlinkSchema>;

export const CONTACT_SORTS = ['last_name', 'first_name', 'created_at'] as const;
export type ContactSort = (typeof CONTACT_SORTS)[number];
