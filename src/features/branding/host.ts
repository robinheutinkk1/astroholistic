import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { publicEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { normalizeHostname } from '@/features/domains/hostname';
import { logoUrl } from './url';

/**
 * Which organisation's branding belongs to the host in the browser's address
 * bar.
 *
 * THIS IS BRANDING, NOT AUTHORISATION. Nothing downstream may treat the host
 * as evidence of which tenant a request belongs to — the Host header is
 * attacker-controlled, and the only reason it is safe here is that the answer
 * is a name and two colours that the visitor is about to be shown anyway.
 * Tenant scope continues to come from the session and from RLS.
 *
 * The lookup runs through a SECURITY DEFINER function that only matches
 * VERIFIED domains, so an unverified claim on someone else's hostname resolves
 * to nothing rather than to their branding.
 */
export interface HostBranding {
  readonly displayName: string | null;
  readonly logoUrl: string | null;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
  readonly hidePlatformBranding: boolean;
}

export const getHostBranding = cache(async (): Promise<HostBranding | null> => {
  const headerList = await headers();
  const host = normalizeHostname(headerList.get('host') ?? '');

  // The platform's own host has no tenant branding, and skipping the query for
  // it keeps the common case free of a round trip.
  if (
    host.length === 0 ||
    host === normalizeHostname(publicEnv.NEXT_PUBLIC_PLATFORM_HOST)
  ) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('branding_for_host', { p_host: host });
  if (error || !data || data.length === 0) return null;

  const row = data[0];
  if (!row) return null;

  return {
    displayName: row.display_name,
    // No version to bust the cache with here: the RPC deliberately does not
    // return updated_at, which would say when a tenant last touched their
    // settings to anyone who can guess a hostname.
    logoUrl: logoUrl(row.logo_path),
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    hidePlatformBranding: row.hide_platform_branding === true,
  };
});
