/**
 * Application error hierarchy (docs/ARCHITECTURE.md §12).
 *
 * Two rules drive the design:
 *
 * 1. Errors carry a stable `code` so the UI can translate them. Matching on
 *    English message text would break the Dutch interface.
 * 2. Nothing user-facing may contain personal data (§38, §45). `context` is for
 *    identifiers only — never names, addresses or e-mail addresses.
 */
export type AppErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_AUTHENTICATED'
  | 'NOT_AUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE_TRANSITION'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export abstract class AppError extends Error {
  abstract readonly code: AppErrorCode;
  /** HTTP-ish status, used by route handlers. */
  abstract readonly status: number;

  /** Identifiers only. Never personal data. */
  readonly context: Readonly<Record<string, string | number | boolean>>;

  constructor(message: string, context: Record<string, string | number | boolean> = {}) {
    super(message);
    this.name = new.target.name;
    this.context = Object.freeze({ ...context });
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_FAILED';
  readonly status = 422;
  /** Field-level messages, keyed by form field path. */
  readonly fieldErrors: Readonly<Record<string, string[]>>;

  constructor(
    message: string,
    fieldErrors: Record<string, string[]> = {},
    context: Record<string, string | number | boolean> = {},
  ) {
    super(message, context);
    this.fieldErrors = Object.freeze({ ...fieldErrors });
  }
}

export class AuthenticationError extends AppError {
  readonly code = 'NOT_AUTHENTICATED';
  readonly status = 401;
}

/**
 * Deliberately indistinguishable from NotFoundError in anything the user sees.
 *
 * If "you may not read this ride" and "this ride does not exist" produce
 * different responses, the difference is an oracle: an attacker learns which
 * identifiers are real in another tenant (docs/SECURITY.md, threat T12).
 */
export class AuthorizationError extends AppError {
  readonly code = 'NOT_AUTHORIZED';
  readonly status = 404;
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly status = 404;
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
  readonly status = 409;
}

export class StateTransitionError extends AppError {
  readonly code = 'INVALID_STATE_TRANSITION';
  readonly status = 409;
}

export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMITED';
  readonly status = 429;
}

export class InternalError extends AppError {
  readonly code = 'INTERNAL';
  readonly status = 500;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
