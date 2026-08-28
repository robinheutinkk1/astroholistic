/**
 * Hostname handling for custom domains.
 *
 * Pure, so every rule below is provable in a unit test rather than only
 * observable against live DNS.
 *
 * WHY THE RULES ARE STRICT. A hostname here decides which organisation's
 * branding an anonymous visitor is shown, and eventually which organisation a
 * request belongs to. A sloppy comparison — trailing dot, uppercase, a port, a
 * unicode homograph — is a way to make two different strings resolve to the
 * same site while only one of them was verified.
 */

/** Labels: letters, digits and hyphens; no leading or trailing hyphen. */
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Reserved names nobody may claim. Verifying one of these would let a tenant
 * take over the platform's own pages.
 */
const RESERVED = new Set(['localhost']);

export type HostnameRejection =
  'EMPTY' | 'INVALID' | 'NOT_A_DOMAIN' | 'RESERVED' | 'TOO_LONG';

export type HostnameCheck =
  | { readonly ok: true; readonly hostname: string }
  | { readonly ok: false; readonly reason: HostnameRejection };

/**
 * Lowercases, strips a port and a trailing root dot.
 *
 * `EXAMPLE.NL.`, `example.nl:443` and `example.nl` are the same host as far as
 * a browser is concerned, so they must be the same string here too.
 */
export function normalizeHostname(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '');
  value = value.split('/')[0] ?? '';
  value = value.split(':')[0] ?? '';
  value = value.replace(/\.+$/, '');
  return value;
}

export function checkHostname(raw: string, platformHost: string): HostnameCheck {
  const hostname = normalizeHostname(raw);
  if (hostname.length === 0) return { ok: false, reason: 'EMPTY' };
  if (hostname.length > 253) return { ok: false, reason: 'TOO_LONG' };

  const labels = hostname.split('.');
  // A single label is a machine name, not a domain someone can prove ownership
  // of with a public DNS record.
  if (labels.length < 2) return { ok: false, reason: 'NOT_A_DOMAIN' };
  if (!labels.every((label) => LABEL.test(label)))
    return { ok: false, reason: 'INVALID' };

  const platform = normalizeHostname(platformHost);
  if (
    RESERVED.has(hostname) ||
    hostname === platform ||
    (platform.length > 0 && hostname.endsWith(`.${platform}`))
  ) {
    // Subdomains of the platform's own host are handed out by the platform, not
    // claimed by tenants. Allowing a claim here would let one organisation
    // verify a hostname that already routes to another's tenant subdomain.
    return { ok: false, reason: 'RESERVED' };
  }

  return { ok: true, hostname };
}

/** The DNS name a tenant publishes the verification token on. */
export const VERIFICATION_PREFIX = '_tagpoint-verify';

export function verificationRecordName(hostname: string): string {
  return `${VERIFICATION_PREFIX}.${hostname}`;
}

export function verificationRecordValue(token: string): string {
  return `tagpoint-domain-verification=${token}`;
}

export const HOSTNAME_MESSAGES: Record<HostnameRejection, string> = {
  EMPTY: 'Vul een domeinnaam in.',
  INVALID: 'Dat is geen geldige domeinnaam.',
  NOT_A_DOMAIN: 'Vul een volledige domeinnaam in, bijvoorbeeld vervoer.voorbeeld.nl.',
  RESERVED: 'Deze domeinnaam kan niet worden gebruikt.',
  TOO_LONG: 'Die domeinnaam is te lang.',
};
