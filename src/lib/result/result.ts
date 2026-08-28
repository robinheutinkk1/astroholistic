import { type AppError } from '@/lib/errors/app-error';

/**
 * Services return Result for *expected* failures — a missing record, a denied
 * permission, an illegal state transition. Unexpected failures still throw.
 *
 * The reason for not throwing on expected failures is that a Server Action has
 * to send something serialisable to the client, and a thrown error in
 * production Next.js is redacted to "an error occurred". That would turn every
 * validation message into a dead end for the user (§45).
 */
export type Result<T, E extends AppError = AppError> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: E };

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E extends AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E extends AppError>(
  result: Result<T, E>,
): result is { readonly ok: true; readonly data: T } {
  return result.ok;
}

/** Unwraps a Result, throwing on failure. Use only where failure is a bug. */
export function unwrap<T, E extends AppError>(result: Result<T, E>): T {
  if (!result.ok) throw result.error;
  return result.data;
}

/** Maps the success value, leaving a failure untouched. */
export function mapResult<T, U, E extends AppError>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  return result.ok ? ok(fn(result.data)) : result;
}
