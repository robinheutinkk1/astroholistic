import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { type Tables } from '@/types/database';
import { LOGO_BUCKET } from './url';
import { type BrandingFormInput } from './schema';
import { type LogoFormat } from './image';

export type BrandingRow = Pick<
  Tables<'organization_branding'>,
  | 'organization_id'
  | 'display_name'
  | 'logo_path'
  | 'favicon_path'
  | 'primary_color'
  | 'secondary_color'
  | 'support_email'
  | 'support_phone'
  | 'hide_platform_branding'
  | 'updated_at'
>;

// One literal, deliberately not concatenated: supabase-js infers the row type
// from the string literal, and a `+` turns it into plain `string`, which
// collapses the result to an untyped error union.
const COLUMNS =
  'organization_id, display_name, logo_path, favicon_path, primary_color, secondary_color, support_email, support_phone, hide_platform_branding, updated_at';

export async function findBranding(organizationId: string): Promise<BrandingRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_branding')
    .select(COLUMNS)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return data;
}

/**
 * Upsert rather than update.
 *
 * An organisation whose branding row is missing — provisioning that failed
 * halfway, an organisation older than the table — would otherwise have a
 * settings screen that silently saves nothing. RLS applies to both halves of
 * the upsert, so this widens nothing.
 */
export async function saveBranding(
  organizationId: string,
  input: BrandingFormInput,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from('organization_branding').upsert(
    {
      organization_id: organizationId,
      display_name: input.displayName,
      primary_color: input.primaryColor,
      secondary_color: input.secondaryColor,
      support_email: input.supportEmail,
      support_phone: input.supportPhone,
      hide_platform_branding: input.hidePlatformBranding,
    },
    { onConflict: 'organization_id' },
  );
  return !error;
}

export async function saveLogoPath(
  organizationId: string,
  logoPath: string | null,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('organization_branding')
    .upsert(
      { organization_id: organizationId, logo_path: logoPath },
      { onConflict: 'organization_id' },
    );
  return !error;
}

export async function uploadLogo(
  path: string,
  // `Uint8Array<ArrayBuffer>` rather than plain `Uint8Array`: since TypeScript
  // 5.7 the latter also covers SharedArrayBuffer-backed views, which a Blob
  // cannot take. The narrower type is what File.arrayBuffer() actually gives.
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<boolean> {
  const supabase = await createClient();
  // The user's own client, so the storage policies from migration 0021 decide.
  // Using the service role here would move the tenant boundary into this file.
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, new Blob([bytes], { type: contentType }), {
      contentType,
      upsert: true,
      cacheControl: '3600',
    });
  return !error;
}

/**
 * Removes the objects a previous upload left behind.
 *
 * The path carries the format, so replacing a PNG with a WebP writes a new
 * object rather than overwriting the old one. Left alone, a tenant's folder
 * would accumulate every logo they ever had — and the old one stays publicly
 * readable, which is the part that matters.
 */
export async function removeOtherLogoObjects(
  organizationId: string,
  keep: LogoFormat | null,
  formats: readonly LogoFormat[],
): Promise<void> {
  const supabase = await createClient();
  const stale = formats
    .filter((format) => format !== keep)
    .map((format) => `${organizationId}/logo.${format}`);
  if (stale.length === 0) return;
  await supabase.storage.from(LOGO_BUCKET).remove(stale);
}
