/**
 * Host resolution for white-label and custom domains
 * (docs/ARCHITECTURE.md §11).
 *
 * IMPORTANT: the host determines *branding and default organisation context*.
 * It never determines authorisation. The Host header is attacker-controlled, so
 * a user visiting dispatch.taxi-ontzorgd.nl without a membership row still sees
 * nothing (docs/SECURITY.md, threat T14).
 */

export type HostKind =
  /** app.tagpoint.nl, localhost, *.vercel.app — organisation comes from the session. */
  | { readonly kind: 'platform' }
  /** A tenant's own domain — organisation is looked up from organization_domains. */
  | { readonly kind: 'custom'; readonly hostname: string };

const PLATFORM_SUFFIXES = ['.vercel.app'] as const;
const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '0.0.0.0'] as const;

/** Strips the port and lowercases, so 'App.Example.NL:3000' → 'app.example.nl'. */
export function normalizeHostname(host: string): string {
  const withoutPort = host.split(':')[0] ?? '';
  return withoutPort.trim().toLowerCase();
}

export function classifyHost(host: string, platformHost: string): HostKind {
  const hostname = normalizeHostname(host);
  const platform = normalizeHostname(platformHost);

  if (!hostname) return { kind: 'platform' };
  if (hostname === platform) return { kind: 'platform' };
  if (LOCAL_HOSTNAMES.some((local) => hostname === local)) return { kind: 'platform' };
  if (PLATFORM_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { kind: 'platform' };
  }

  return { kind: 'custom', hostname };
}
