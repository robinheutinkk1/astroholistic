import { z } from 'zod';

const optionalText = (max: number, message: string) =>
  z
    .string()
    .max(max, message)
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null);

export const LOCATION_KINDS = [
  'HOME',
  'SCHOOL',
  'DAY_CARE',
  'CARE_FACILITY',
  'WORK',
  'STATION',
  'HOSPITAL',
  'OTHER',
] as const;

export const LOCATION_KIND_LABELS: Record<(typeof LOCATION_KINDS)[number], string> = {
  HOME: 'Woonadres',
  SCHOOL: 'School',
  DAY_CARE: 'Dagbesteding',
  CARE_FACILITY: 'Zorginstelling',
  WORK: 'Werk',
  STATION: 'Station',
  HOSPITAL: 'Ziekenhuis',
  OTHER: 'Overig',
};

export const locationFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Vul een naam in.')
    .max(120)
    .transform((v) => v.trim()),
  kind: z.enum(LOCATION_KINDS).catch('OTHER'),
  addressLine1: optionalText(120, 'Dat adres is te lang.'),
  postalCode: optionalText(12, 'Die postcode is te lang.'),
  city: optionalText(80, 'Die plaatsnaam is te lang.'),
  // Practical instructions for the driver: "bell at the back door". Not
  // personal or medical information — that belongs nowhere in this product.
  accessNotes: optionalText(300, 'Die toelichting is te lang.'),
  status: z.enum(['ACTIVE', 'INACTIVE']).catch('ACTIVE'),
  /**
   * De opdrachtgever waar deze locatie een vestiging van is.
   *
   * Leeg voor een woonadres, een station of een ziekenhuis: die horen bij
   * niemand. Eén opdrachtgever heeft doorgaans meerdere vestigingen, en dat is
   * precies waarom dit veld op de locatie staat en niet andersom.
   */
  careOrganizationId: z
    .union([z.literal(''), z.uuid()])
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .catch(null),
});

export type LocationFormInput = z.infer<typeof locationFormSchema>;
export const LOCATION_SORTS = ['name', 'city', 'kind', 'created_at'] as const;
export type LocationSort = (typeof LOCATION_SORTS)[number];
