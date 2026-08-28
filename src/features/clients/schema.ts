import { z } from 'zod';

/**
 * Client validation.
 *
 * Note what is absent (decision D-03): no transport requirements, no free-text
 * notes, no date of birth, no BSN. Transport needs live on the ride. A free
 * field on a person becomes a medical record, which this product is not.
 *
 * If a planner asks for such a field, that request goes through D-03 — it does
 * not arrive quietly as "one small addition to the form".
 */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .max(max, message)
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null);

export const clientFormSchema = z.object({
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
    .union([z.literal(''), z.email('Dat lijkt geen geldig e-mailadres.')])
    .transform((value) => (value === '' ? null : value.toLowerCase()))
    .nullable(),
  addressLine1: optionalText(120, 'Dat adres is te lang.'),
  postalCode: optionalText(12, 'Die postcode is te lang.'),
  city: optionalText(80, 'Die plaatsnaam is te lang.'),
  externalReference: optionalText(60, 'Die referentie is te lang.'),
  status: z.enum(['ACTIVE', 'INACTIVE']).catch('ACTIVE'),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;

export const CLIENT_SORTS = ['last_name', 'first_name', 'city', 'created_at'] as const;
export type ClientSort = (typeof CLIENT_SORTS)[number];
