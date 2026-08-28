import { z } from 'zod';
import { RIDE_STATUSES } from './status';

const TRANSPORT_REQUIREMENTS = [
  'WHEELCHAIR',
  'WALKER',
  'ASSISTANCE_TO_DOOR',
  'SEATBELT_SUPPORT',
  'COMPANION_SEAT',
] as const;

export const TRANSPORT_REQUIREMENT_LABELS: Record<
  (typeof TRANSPORT_REQUIREMENTS)[number],
  string
> = {
  WHEELCHAIR: 'Rolstoel',
  WALKER: 'Rollator',
  ASSISTANCE_TO_DOOR: 'Begeleiding tot de deur',
  SEATBELT_SUPPORT: 'Gordelondersteuning',
  COMPANION_SEAT: 'Plaats voor begeleider',
};

export const ABSENCE_REASONS = [
  'NOT_HOME',
  'CANCELLED_BY_CLIENT',
  'ILL',
  'NO_ACCESS',
  'OTHER',
] as const;

export const ABSENCE_REASON_LABELS: Record<(typeof ABSENCE_REASONS)[number], string> = {
  NOT_HOME: 'Niet thuis',
  CANCELLED_BY_CLIENT: 'Afgezegd',
  ILL: 'Ziek',
  NO_ACCESS: 'Geen toegang',
  OTHER: 'Anders',
};

const uuid = z.uuid('Maak een keuze.');
const optionalUuid = z
  .union([z.literal(''), z.uuid()])
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const rideFormSchema = z
  .object({
    clientId: uuid,
    pickupLocationId: uuid,
    destinationLocationId: uuid,
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Kies een datum.'),
    scheduledPickupTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Kies een tijd.'),
    driverId: optionalUuid,
    vehicleId: optionalUuid,
    transportRequirements: z.array(z.enum(TRANSPORT_REQUIREMENTS)).default([]),
    notes: z
      .string()
      .max(500, 'Die notitie is te lang.')
      .transform((value) => value.trim())
      .transform((value) => (value.length === 0 ? null : value))
      .nullable()
      .catch(null),
  })
  .refine((values) => values.pickupLocationId !== values.destinationLocationId, {
    message: 'Ophalen en afleveren kan niet op dezelfde locatie.',
    path: ['destinationLocationId'],
  });

export const assignRideSchema = z.object({
  rideId: uuid,
  driverId: optionalUuid,
  vehicleId: optionalUuid,
});

export const changeStatusSchema = z.object({
  rideId: uuid,
  status: z.enum(RIDE_STATUSES),
  absenceReason: z.enum(ABSENCE_REASONS).optional(),
});

export const cancelRideSchema = z.object({
  rideId: uuid,
  reason: z
    .string()
    .max(300, 'Die reden is te lang.')
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null),
});

export type RideFormInput = z.infer<typeof rideFormSchema>;
export type AssignRideInput = z.infer<typeof assignRideSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type CancelRideInput = z.infer<typeof cancelRideSchema>;

export const RIDE_SORTS = ['scheduled_pickup_at', 'scheduled_date', 'status'] as const;
export type RideSort = (typeof RIDE_SORTS)[number];
