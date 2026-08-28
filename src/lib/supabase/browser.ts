import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import { type Database } from '@/types/database';

/**
 * Supabase client for Client Components.
 *
 * Uses the anon key, which is public by design: it is only safe because RLS is
 * enabled on every table. That assumption is verified by the tenant-isolation
 * suite in tests/security (docs/SECURITY.md §8).
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
