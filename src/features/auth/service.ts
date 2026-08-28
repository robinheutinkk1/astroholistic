import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { AuthenticationError, ValidationError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import {
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
  type UpdateProfileInput,
} from './schema';

/**
 * Authentication operations.
 *
 * Supabase returns English, implementation-flavoured messages
 * ("Invalid login credentials"). We translate to Dutch and — importantly —
 * collapse distinguishable failures into one, so the response cannot be used to
 * discover which e-mail addresses have accounts.
 */

export async function signIn(input: SignInInput): Promise<Result<{ userId: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error || !data.user) {
    // Wrong password and unknown account give the same answer on purpose.
    return err(
      new AuthenticationError('E-mailadres of wachtwoord klopt niet.', {
        reason: error?.code ?? 'unknown',
      }),
    );
  }

  return ok({ userId: data.user.id });
}

export async function signOut(): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return err(new AuthenticationError('Uitloggen is niet gelukt. Probeer het opnieuw.'));
  }
  return ok(null);
}

/**
 * Always reports success.
 *
 * Telling the visitor "that address is unknown" would turn this form into an
 * account-enumeration tool. The e-mail is only sent if the account exists.
 */
export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<Result<null>> {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });
  return ok(null);
}

export async function resetPassword(input: ResetPasswordInput): Promise<Result<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(
      new AuthenticationError(
        'Deze herstellink is verlopen of al gebruikt. Vraag een nieuwe aan.',
      ),
    );
  }

  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) {
    return err(
      new ValidationError('Het wachtwoord kon niet worden opgeslagen.', {
        password: [error.message],
      }),
    );
  }
  return ok(null);
}

export async function updateProfile(input: UpdateProfileInput): Promise<Result<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err(new AuthenticationError('Je bent niet ingelogd.'));

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: input.fullName, phone: input.phone ?? null })
    .eq('id', user.id);

  if (error) {
    return err(new ValidationError('Je profiel kon niet worden opgeslagen.'));
  }
  return ok(null);
}
