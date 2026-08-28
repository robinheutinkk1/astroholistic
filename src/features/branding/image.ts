/**
 * Validating an uploaded logo.
 *
 * THE DECLARED TYPE IS NOT EVIDENCE. A browser sends whatever Content-Type it
 * likes, and an attacker sends whatever they like. So this reads the first
 * bytes of the file and decides from those — a file claiming to be a PNG but
 * starting with `<svg` is rejected on what it is, not on what it says.
 *
 * SVG IS REFUSED ENTIRELY (docs/SECURITY.md §10). An SVG is a document, not an
 * image: it can carry <script>, external references and event handlers. Served
 * from our own origin as a tenant's logo, that is stored XSS on every page of
 * that tenant.
 */
export const MAX_LOGO_BYTES = 512 * 1024;

export type LogoFormat = 'png' | 'jpeg' | 'webp';

export type LogoRejection =
  'EMPTY' | 'TOO_LARGE' | 'UNSUPPORTED_FORMAT' | 'SVG_NOT_ALLOWED';

export type LogoCheck =
  | { readonly ok: true; readonly format: LogoFormat; readonly contentType: string }
  | { readonly ok: false; readonly reason: LogoRejection };

const CONTENT_TYPES: Record<LogoFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

/** Detects the real format from the file's magic bytes. */
export function detectImageFormat(bytes: Uint8Array): LogoFormat | 'svg' | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';

  // RIFF....WEBP
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }

  // SVG is text, and may open with whitespace, a BOM, an XML declaration or a
  // comment before the root element. Scan a window rather than the first bytes.
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.slice(0, 1024))
    .toLowerCase();
  if (head.includes('<svg') || head.includes('<!doctype svg')) return 'svg';

  return null;
}

export function checkLogo(bytes: Uint8Array): LogoCheck {
  if (bytes.length === 0) return { ok: false, reason: 'EMPTY' };
  if (bytes.length > MAX_LOGO_BYTES) return { ok: false, reason: 'TOO_LARGE' };

  const format = detectImageFormat(bytes);
  if (format === 'svg') return { ok: false, reason: 'SVG_NOT_ALLOWED' };
  if (format === null) return { ok: false, reason: 'UNSUPPORTED_FORMAT' };

  return { ok: true, format, contentType: CONTENT_TYPES[format] };
}

export const LOGO_REJECTION_MESSAGES: Record<LogoRejection, string> = {
  EMPTY: 'Het bestand is leeg.',
  TOO_LARGE: `Het logo mag maximaal ${Math.round(MAX_LOGO_BYTES / 1024)} kB zijn.`,
  UNSUPPORTED_FORMAT: 'Gebruik een PNG-, JPG- of WEBP-bestand.',
  SVG_NOT_ALLOWED:
    'SVG-bestanden kunnen scripts bevatten en worden daarom niet geaccepteerd. Exporteer je logo als PNG.',
};

/**
 * The stored filename.
 *
 * Never the name the user supplied: that can contain path separators, null
 * bytes, or a second extension. The organisation id plus the detected format
 * is all the information the file needs to carry.
 */
export function logoObjectPath(organizationId: string, format: LogoFormat): string {
  return `${organizationId}/logo.${format}`;
}

/**
 * Brand colours, validated before they reach a stylesheet.
 *
 * These end up in a CSS custom property. Anything other than a literal hex
 * value would let a tenant inject CSS into their own users' pages — and in a
 * white-label product, "their own users" includes clients and parents.
 */
const HEX = /^#[0-9a-f]{6}$/i;

export function isValidBrandColor(value: string): boolean {
  return HEX.test(value.trim());
}

export function normalizeBrandColor(value: string): string | null {
  const trimmed = value.trim();
  return HEX.test(trimmed) ? trimmed.toLowerCase() : null;
}
