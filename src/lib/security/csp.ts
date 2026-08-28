/**
 * Content-Security-Policy.
 *
 * WHY A NONCE. Next.js injects its own inline bootstrap script into every
 * page. A policy without `unsafe-inline` blocks it and the app does not
 * hydrate; a policy *with* `unsafe-inline` permits every other injected script
 * too, which is the whole thing a CSP exists to stop. A per-request nonce is
 * the way out: Next stamps the nonce onto its own scripts when it sees one on
 * the request, and nothing else can guess it.
 *
 * `strict-dynamic` lets those nonced scripts load the chunks they need without
 * every chunk URL having to be listed here.
 *
 * WHY `unsafe-inline` IS STILL THERE FOR STYLES. Two reasons, both real:
 * Next inlines critical CSS, and the white-label theme sets custom properties
 * with a `style` attribute per tenant (fase 10). Nonces do not apply to style
 * *attributes* at all, so removing this would mean giving up server-rendered
 * tenant colours. The exposure is limited to CSS, which cannot execute.
 *
 * This module is pure so the policy can be asserted in a test rather than read
 * off a running server.
 */
export interface CspOptions {
  readonly nonce: string;
  /** Supabase project URL: the app talks to it over HTTPS and WebSocket. */
  readonly supabaseUrl: string;
  /** In development Next uses eval for hot reloading and inline sourcemaps. */
  readonly development?: boolean;
}

function toOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    // A malformed URL must not silently widen the policy to everything.
    return "'none'";
  }
}

export function buildCsp({
  nonce,
  supabaseUrl,
  development = false,
}: CspOptions): string {
  const supabase = toOrigin(supabaseUrl);
  const websocket = supabase.startsWith('http')
    ? supabase.replace(/^http/, 'ws')
    : "'none'";

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Browsers that ignore strict-dynamic fall back to the host list, which
    // 'self' covers. `https:` is deliberately NOT listed.
    ...(development ? ["'unsafe-eval'"] : []),
  ];

  const directives: Record<string, readonly string[]> = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    // See the note above: style nonces do not cover style attributes.
    'style-src': ["'self'", "'unsafe-inline'"],
    // data:/blob: for the QR codes the app generates client-side; the Supabase
    // origin for tenant logos.
    'img-src': ["'self'", 'data:', 'blob:', supabase],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", supabase, websocket],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    // Belt and braces with X-Frame-Options, which older browsers use instead.
    'frame-ancestors': ["'none'"],
    // Without this, a stored-XSS payload could still post the page's data to
    // an attacker by submitting a form.
    'form-action': ["'self'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
  };

  const parts = Object.entries(directives).map(
    ([directive, values]) => `${directive} ${values.join(' ')}`,
  );

  // Not in development: the dev server serves over http and this would break
  // every asset.
  if (!development) parts.push('upgrade-insecure-requests');

  return parts.join('; ');
}

/**
 * A fresh nonce per response.
 *
 * `crypto.getRandomValues` rather than Math.random: a guessable nonce is the
 * same as no nonce at all.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
