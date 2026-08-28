import { z } from 'zod';

/**
 * Environment validation (docs/SECURITY.md §7).
 *
 * Client and server schemas are separate so that a server secret can never be
 * read from a component that also runs in the browser. The public schema is the
 * only one safe to reference from client code.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_PLATFORM_HOST: z.string().min(1).default('localhost:3000'),
});

/**
 * Next.js inlines process.env.NEXT_PUBLIC_* at build time only when referenced
 * as a full static member expression, so these cannot be read dynamically.
 */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_PLATFORM_HOST: process.env.NEXT_PUBLIC_PLATFORM_HOST,
});

export type PublicEnv = z.infer<typeof publicSchema>;
