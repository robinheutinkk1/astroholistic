import { publicEnv } from '@/lib/env';
import { type LogoFormat } from './image';

/**
 * Turning a stored object path into something an <img> can load.
 *
 * The URL is *assembled*, never stored. A stored URL is a string a tenant
 * administrator could rewrite through PostgREST with their own token; an
 * assembled one can only ever point at our own storage bucket. The database
 * additionally constrains the path to the organisation's own folder
 * (migration 0021).
 */
export const LOGO_BUCKET = 'organization-logos';

/** All the extensions a logo can have, for cleaning up after a format change. */
export const LOGO_FORMATS: readonly LogoFormat[] = ['png', 'jpeg', 'webp'];

/**
 * Pure builder, so the shape can be asserted in a test without a Supabase
 * project. `version` busts the CDN cache: the object path is stable across
 * uploads by design, so without it a replaced logo would keep serving the old
 * bytes until the edge cache expired.
 */
export function buildLogoUrl(
  supabaseUrl: string,
  path: string,
  version?: string | null,
): string {
  const base = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${LOGO_BUCKET}/${path}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

export function logoUrl(
  path: string | null | undefined,
  version?: string | null,
): string | null {
  if (!path) return null;
  return buildLogoUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, path, version);
}
