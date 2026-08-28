'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { toFormState, type FormState } from '@/lib/errors/form-state';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  updateProfileSchema,
} from './schema';
import * as authService from './service';

/**
 * Server Actions: a thin layer. Parse, call the service, shape the result for
 * the form. No business logic lives here (docs/ARCHITECTURE.md §4).
 */

export async function signInAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    redirectTo: formData.get('redirectTo') ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Controleer de ingevulde gegevens.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await authService.signIn(parsed.data);
  if (!result.ok) return toFormState(result.error, 'auth action');

  // Only relative paths: an attacker-supplied absolute URL here would turn the
  // login form into an open redirect.
  const next = parsed.data.redirectTo;
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  // The cast is unavoidable with typedRoutes: the destination is only known at
  // runtime. It is safe because of the guard above, which is covered by
  // redirect.test.ts.
  redirect(safeNext as Route);
}

export async function signOutAction(): Promise<never> {
  await authService.signOut();
  redirect('/login');
}

export async function forgotPasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Controleer het e-mailadres.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await authService.requestPasswordReset(parsed.data);
  // Deliberately the same answer whether or not the account exists.
  return {
    status: 'success',
    message:
      'Als er een account bestaat met dit e-mailadres, is er een herstellink verstuurd.',
  };
}

export async function resetPasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    passwordConfirmation: formData.get('passwordConfirmation'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Controleer de ingevulde gegevens.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await authService.resetPassword(parsed.data);
  if (!result.ok) return toFormState(result.error, 'auth action');
  redirect('/dashboard');
}

export async function updateProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateProfileSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone') ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Controleer de ingevulde gegevens.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await authService.updateProfile(parsed.data);
  if (!result.ok) return toFormState(result.error, 'auth action');

  revalidatePath('/profiel');
  return { status: 'success', message: 'Je profiel is opgeslagen.' };
}
