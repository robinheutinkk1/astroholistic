import { z } from 'zod';
import { isValidBrandColor } from './image';

/**
 * The branding form.
 *
 * Colours are validated here *and* by a CHECK constraint in the database. The
 * duplication is deliberate: this layer produces a friendly Dutch message, the
 * database makes the guarantee. Only one of them is reachable from a crafted
 * PostgREST call, and it is not this one.
 */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .max(max, message)
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null);

const optionalColor = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? null : value.toLowerCase()))
  .nullable()
  .refine((value) => value === null || isValidBrandColor(value), {
    message: 'Gebruik een hexkleur, bijvoorbeeld #1f47d6.',
  });

export const brandingFormSchema = z.object({
  displayName: optionalText(60, 'Die naam is te lang.'),
  primaryColor: optionalColor,
  secondaryColor: optionalColor,
  supportEmail: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .refine((value) => value === null || z.email().safeParse(value).success, {
      message: 'Vul een geldig e-mailadres in.',
    }),
  supportPhone: optionalText(30, 'Dat telefoonnummer is te lang.'),
  // Whether "Powered by Tagpoint" is shown. In a finished SaaS this belongs in
  // plans.limits as a paid entitlement (§36); today every organisation may set
  // it, and the plan gate is a deliberate later addition rather than an
  // oversight (docs/RISKS_AND_DECISIONS.md D-20).
  hidePlatformBranding: z
    .union([z.literal('on'), z.literal('true'), z.literal(''), z.null(), z.undefined()])
    .transform((value) => value === 'on' || value === 'true'),
});

export type BrandingFormInput = z.infer<typeof brandingFormSchema>;
