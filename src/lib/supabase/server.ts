import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env';
import { type Database } from '@/types/database';

/**
 * Supabase client for Server Components, Server Actions and route handlers.
 *
 * Runs with the signed-in user's JWT, so every query is subject to RLS. This is
 * the client that virtually all application code should use.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Session refresh happens in
            // middleware instead, so ignoring this is correct rather than a
            // swallowed error.
          }
        },
      },
    },
  );
}
