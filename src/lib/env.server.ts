import 'server-only';
import { z } from 'zod';

/**
 * Server-only secrets.
 *
 * The `server-only` import above turns an accidental client import into a build
 * failure rather than a production leak (docs/SECURITY.md, threat T11).
 *
 * Each secret is validated on its own, on first use. Validating them together
 * would couple unrelated features: ride generation would refuse to run because
 * TAG_TOKEN_PEPPER — a Fase 7 secret it never touches — happened to be unset.
 */
const schemas = {
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is not set'),
  /** Pepper for NFC/QR token hashing — kept outside the database on purpose. */
  TAG_TOKEN_PEPPER: z.string().min(32, 'TAG_TOKEN_PEPPER must be at least 32 characters'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
} as const;

export type ServerSecret = keyof typeof schemas;

const cache = new Map<ServerSecret, string>();

/** Throws if the secret is missing or malformed. */
export function requireSecret(name: ServerSecret): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const value = schemas[name].parse(process.env[name]);
  cache.set(name, value);
  return value;
}

/**
 * Returns null instead of throwing when a secret is not configured.
 *
 * Lets a route answer "this endpoint is not configured" with a proper status
 * code rather than a 500 whose stack trace names the variable.
 */
export function optionalSecret(name: ServerSecret): string | null {
  try {
    return requireSecret(name);
  } catch {
    return null;
  }
}
