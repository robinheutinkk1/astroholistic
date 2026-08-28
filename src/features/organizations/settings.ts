import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * The organisation's timezone.
 *
 * Every screen that shows "today" needs this, and until now each one repeated
 * the same four-line query plus the same fallback. Six copies of a default is
 * six chances for one of them to drift — and a screen that silently falls back
 * to UTC shows a planner the wrong day's rides for an hour each evening.
 *
 * Cached per request, so a page that needs it twice queries once.
 */
export const DEFAULT_TIMEZONE = 'Europe/Amsterdam';

export const getOrganizationTimezone = cache(
  async (organizationId: string): Promise<string> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('organization_settings')
      .select('timezone')
      .eq('organization_id', organizationId)
      .maybeSingle();

    return data?.timezone ?? DEFAULT_TIMEZONE;
  },
);
