import { z } from 'zod';

const optionalText = (max: number, message: string) =>
  z
    .string()
    .max(max, message)
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null);

export const vehicleFormSchema = z
  .object({
    licensePlate: z
      .string()
      .min(1, 'Vul een kenteken in.')
      .max(15, 'Dat kenteken is te lang.')
      .transform((value) => value.trim().toUpperCase()),
    make: optionalText(60, 'Dat merk is te lang.'),
    model: optionalText(60, 'Dat model is te lang.'),
    vehicleType: optionalText(60, 'Dat voertuigtype is te lang.'),
    seats: z.coerce.number().int().min(0, 'Kan niet negatief zijn.').max(99),
    wheelchairPositions: z.coerce
      .number()
      .int()
      .min(0, 'Kan niet negatief zijn.')
      .max(20),
    status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).catch('ACTIVE'),
  })
  .refine((values) => values.wheelchairPositions <= values.seats, {
    message: 'Er kunnen niet meer rolstoelplaatsen zijn dan zitplaatsen.',
    path: ['wheelchairPositions'],
  });

export type VehicleFormInput = z.infer<typeof vehicleFormSchema>;
export const VEHICLE_SORTS = ['license_plate', 'make', 'seats', 'created_at'] as const;
export type VehicleSort = (typeof VEHICLE_SORTS)[number];

export const VEHICLE_STATUS_LABELS = {
  ACTIVE: 'Actief',
  INACTIVE: 'Inactief',
  MAINTENANCE: 'Onderhoud',
} as const;
