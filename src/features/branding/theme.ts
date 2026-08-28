import { type CSSProperties } from 'react';
import { normalizeBrandColor } from './image';

/**
 * Turning stored branding into a style object.
 *
 * EVERY COLOUR IS RE-VALIDATED HERE. The database already constrains these
 * columns to a hex literal, and the form validates them too — but this is the
 * layer that writes the value into a stylesheet, and a value that reaches a
 * stylesheet unchecked is a CSS injection. Three checks is not paranoia when
 * the failure mode is one tenant styling another tenant's page.
 *
 * Anything that is not a plain `#rrggbb` is dropped, which falls back to the
 * platform palette rather than producing a broken page.
 */
export interface BrandingLike {
  readonly display_name?: string | null;
  readonly primary_color?: string | null;
  readonly secondary_color?: string | null;
  readonly hide_platform_branding?: boolean | null;
}

export function brandStyle(branding: BrandingLike | null | undefined): CSSProperties {
  if (!branding) return {};

  const primary = branding.primary_color
    ? normalizeBrandColor(branding.primary_color)
    : null;
  const secondary = branding.secondary_color
    ? normalizeBrandColor(branding.secondary_color)
    : null;

  return {
    ...(primary ? { '--tp-primary': primary } : {}),
    ...(secondary ? { '--tp-secondary': secondary } : {}),
  } as CSSProperties;
}

/** The name to print, with a fallback chain that never renders empty. */
export function brandName(
  branding: BrandingLike | null | undefined,
  fallback: string,
): string {
  const name = branding?.display_name?.trim();
  return name && name.length > 0 ? name : fallback;
}

export function showsPlatformBranding(
  branding: BrandingLike | null | undefined,
): boolean {
  return branding?.hide_platform_branding !== true;
}
