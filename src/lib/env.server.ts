import 'server-only';
import { z } from 'zod';

/**
 * Server-only environment. The `server-only` import above turns an accidental
 * client import into a build failure rather than a production leak
 * (docs/SECURITY.md, threat T11).
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** Pepper for NFC/QR token hashing — kept outside the database on purpose. */
  TAG_TOKEN_PEPPER: z.string().min(32, 'TAG_TOKEN_PEPPER must be at least 32 chars'),
  CRON_SECRET: z.string().min(16),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/**
 * Parsed lazily rather than at module load: the values are only needed by the
 * few server paths that use them, and requiring every developer to have a
 * TAG_TOKEN_PEPPER before `next dev` starts would be friction with no benefit.
 */
export function serverEnv(): ServerEnv {
  cached ??= serverSchema.parse(process.env);
  return cached;
}
