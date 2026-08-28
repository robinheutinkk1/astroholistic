import { z } from 'zod';

/**
 * Validation at the boundary. These schemas are the single place input is
 * validated; services trust their parsed input (docs/ARCHITECTURE.md §4).
 */

const email = z
  .string()
  .min(1, 'Vul je e-mailadres in.')
  .email('Dat lijkt geen geldig e-mailadres.')
  .transform((value) => value.trim().toLowerCase());

/**
 * Twelve characters rather than the more common eight.
 *
 * Length beats composition rules: a long passphrase is both stronger and easier
 * to remember than "P@ssw0rd!". We deliberately do not require mixed case or
 * symbols, which mostly produce predictable substitutions.
 */
const password = z
  .string()
  .min(12, 'Gebruik minimaal 12 tekens. Een zin werkt goed en is makkelijk te onthouden.')
  .max(200, 'Dat wachtwoord is te lang.');

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Vul je wachtwoord in.'),
  redirectTo: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'De twee wachtwoorden zijn niet gelijk.',
    path: ['passwordConfirmation'],
  });

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Vul je naam in.')
    .max(120, 'Die naam is te lang.')
    .transform((value) => value.trim()),
  phone: z
    .string()
    .max(30, 'Dat telefoonnummer is te lang.')
    .transform((value) => value.trim())
    .optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
