import { z } from 'zod';

const uuid = z.uuid('Maak een keuze.');
const optionalUuid = z
  .union([z.literal(''), z.uuid()])
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const rideTemplateFormSchema = z
  .object({
    clientId: uuid,
    name: z
      .string()
      .max(120, 'Die naam is te lang.')
      .transform((value) => value.trim())
      .transform((value) => (value.length === 0 ? null : value))
      .nullable()
      .catch(null),
    pickupLocationId: uuid,
    destinationLocationId: uuid,
    departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Kies een vertrektijd.'),
    daysOfWeek: z
      .array(z.coerce.number().int().min(1).max(7))
      .min(1, 'Kies minimaal één dag.'),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Kies een startdatum.'),
    endsOn: z
      .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ongeldige datum.')])
      .transform((value) => (value === '' ? null : value))
      .nullable(),
    defaultDriverId: optionalUuid,
    defaultVehicleId: optionalUuid,
    transportRequirements: z
      .array(
        z.enum([
          'WHEELCHAIR',
          'WALKER',
          'ASSISTANCE_TO_DOOR',
          'SEATBELT_SUPPORT',
          'COMPANION_SEAT',
        ]),
      )
      .default([]),
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).catch('ACTIVE'),
  })
  .refine((values) => values.pickupLocationId !== values.destinationLocationId, {
    message: 'Ophalen en afleveren kan niet op dezelfde locatie.',
    path: ['destinationLocationId'],
  })
  .refine((values) => !values.endsOn || values.endsOn >= values.startsOn, {
    message: 'De einddatum ligt vóór de startdatum.',
    path: ['endsOn'],
  });

export type RideTemplateFormInput = z.infer<typeof rideTemplateFormSchema>;

export const TEMPLATE_STATUS_LABELS = {
  ACTIVE: 'Actief',
  PAUSED: 'Gepauzeerd',
  ARCHIVED: 'Gearchiveerd',
} as const;

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Ma' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Wo' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Vr' },
  { value: 6, label: 'Za' },
  { value: 7, label: 'Zo' },
] as const;

export const TEMPLATE_SORTS = ['departure_time', 'created_at'] as const;
export type TemplateSort = (typeof TEMPLATE_SORTS)[number];
