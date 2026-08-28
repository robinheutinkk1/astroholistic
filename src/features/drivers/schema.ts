import { z } from 'zod';

const optionalText = (max: number, message: string) =>
  z
    .string()
    .max(max, message)
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null);

export const driverFormSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Vul een voornaam in.')
    .max(80)
    .transform((v) => v.trim()),
  lastName: z
    .string()
    .min(1, 'Vul een achternaam in.')
    .max(80)
    .transform((v) => v.trim()),
  employeeNumber: optionalText(40, 'Dat medewerkernummer is te lang.'),
  phone: optionalText(30, 'Dat telefoonnummer is te lang.'),
  email: z
    .union([z.literal(''), z.email('Dat lijkt geen geldig e-mailadres.')])
    .transform((value) => (value === '' ? null : value.toLowerCase()))
    .nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).catch('ACTIVE'),
});

export type DriverFormInput = z.infer<typeof driverFormSchema>;
export const DRIVER_SORTS = [
  'last_name',
  'first_name',
  'employee_number',
  'created_at',
] as const;
export type DriverSort = (typeof DRIVER_SORTS)[number];

export const DRIVER_STATUS_LABELS = {
  ACTIVE: 'Actief',
  INACTIVE: 'Inactief',
  ON_LEAVE: 'Afwezig',
} as const;
