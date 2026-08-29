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
 * Een zorgorganisatie is de opdrachtgever achter een cliënt: een gemeente, een
 * zorginstelling, een school. Zij betaalt het vervoer en wil weten of het is
 * gereden — maar krijgt nooit meer te zien dan de cliënten die zij zelf
 * financiert.
 */
export const careOrganizationFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Vul een naam in.')
    .max(160, 'Die naam is te lang.')
    .transform((value) => value.trim()),
  contactEmail: z
    .union([
      z.literal(''),
      z.string().email('Dat lijkt geen geldig e-mailadres.').max(160),
    ])
    .transform((value) => (value === '' ? null : value.trim().toLowerCase()))
    .nullable()
    .catch(null),
  phone: optionalText(30, 'Dat telefoonnummer is te lang.'),
  addressLine1: optionalText(120, 'Dat adres is te lang.'),
  postalCode: optionalText(12, 'Die postcode is te lang.'),
  city: optionalText(80, 'Die plaatsnaam is te lang.'),
  externalReference: optionalText(60, 'Die referentie is te lang.'),
  status: z.enum(['ACTIVE', 'INACTIVE']).catch('ACTIVE'),
});

export type CareOrganizationFormInput = z.infer<typeof careOrganizationFormSchema>;

/**
 * De koppeling tussen een cliënt en zijn opdrachtgever, mét geldigheidsperiode.
 *
 * De periode is geen administratieve luxe: een gemeente die de indicatie in
 * juni beëindigt, hoort de ritten van juli niet meer te zien. RLS leest
 * `valid_from`/`valid_to`, dus dat gebeurt vanzelf.
 */
export const careOrganizationLinkSchema = z
  .object({
    clientId: z.uuid(),
    careOrganizationId: z.uuid(),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Kies een begindatum.'),
    validTo: z
      .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ongeldige datum.')])
      .transform((value) => (value === '' ? null : value))
      .nullable()
      .catch(null),
  })
  .refine((value) => value.validTo === null || value.validTo >= value.validFrom, {
    message: 'De einddatum kan niet vóór de begindatum liggen.',
    path: ['validTo'],
  });

export type CareOrganizationLinkInput = z.infer<typeof careOrganizationLinkSchema>;

export const careOrganizationUnlinkSchema = z.object({
  clientId: z.uuid(),
  careOrganizationId: z.uuid(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CareOrganizationUnlinkInput = z.infer<typeof careOrganizationUnlinkSchema>;

export const CARE_ORGANIZATION_SORTS = ['name', 'city', 'created_at'] as const;
export type CareOrganizationSort = (typeof CARE_ORGANIZATION_SORTS)[number];
