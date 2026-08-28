import { isAppError, ValidationError } from './app-error';

/**
 * The shape a Server Action returns to a form.
 *
 * Lives in lib rather than in a feature because every feature's actions need
 * it, and three near-identical copies of `toFormState` is exactly the
 * duplicated logic §67.11 warns about.
 */
export interface FormState {
  readonly status: 'idle' | 'error' | 'success';
  readonly message?: string;
  readonly fieldErrors?: Record<string, string[]>;
}

export const IDLE: FormState = { status: 'idle' };

/**
 * Turns an error into something safe to show a user.
 *
 * An unexpected error's text is never surfaced: it can carry schema names,
 * hostnames or query fragments (docs/SECURITY.md §12). Those go to the server
 * log; the user gets a plain sentence.
 */
export function toFormState(error: unknown, context: string): FormState {
  if (error instanceof ValidationError) {
    return {
      status: 'error',
      message: error.message,
      fieldErrors: { ...error.fieldErrors },
    };
  }
  if (isAppError(error)) {
    return { status: 'error', message: error.message };
  }
  console.error(`Unexpected error in ${context}`, error);
  return { status: 'error', message: 'Er ging iets mis. Probeer het opnieuw.' };
}

/** Maps a Zod flatten() result onto the form state. */
export function fromValidationIssues(
  fieldErrors: Record<string, string[] | undefined>,
  message = 'Controleer de ingevulde gegevens.',
): FormState {
  const cleaned: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (value && value.length > 0) cleaned[key] = value;
  }
  return { status: 'error', message, fieldErrors: cleaned };
}
