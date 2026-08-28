/**
 * TagPoint tag identifiers (docs/NFC.md §2).
 *
 * Every tag carries two identifiers with different jobs:
 *
 *   public_code  TP-TAXI-8F3A21   for people: the label, inventory, support
 *   token        22 random chars  for machines: the URL
 *
 * The distinction is the point. A readable code in the URL is enumerable — see
 * TP-TAXI-8F3A21 on a tag and you try 8F3A22. With 128 random bits, guessing is
 * pointless. And because the database stores only a hash of the token, a
 * database dump yields no working tag URLs.
 */

/**
 * Crockford-style base32 without I, L, O and U.
 *
 * Those four are removed because a support call goes "is that an i or a one?",
 * and because U keeps unfortunate words out of generated codes.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 16 bytes = 128 bits, the same order of magnitude as a UUID. */
export const TOKEN_BYTES = 16;
export const TOKEN_LENGTH = 26;

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];

  return output;
}

/**
 * A token is only ever compared after normalisation.
 *
 * Someone typing a code by hand from a label writes lower case, adds spaces, or
 * types O for 0 and I for 1. Normalising here means those all resolve to the
 * same tag instead of a confusing "unknown tag".
 */
export function normalizeToken(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[OQ]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
}

export function isPlausibleToken(raw: string): boolean {
  const normalized = normalizeToken(raw);
  if (normalized.length !== TOKEN_LENGTH) return false;
  return [...normalized].every((character) => ALPHABET.includes(character));
}

/**
 * A short, human-facing code.
 *
 * Not unique on its own — uniqueness is enforced per organisation by a database
 * index — and never used for authentication.
 */
export function formatPublicCode(prefix: string, random: string): string {
  return `TP-${prefix.toUpperCase()}-${random.toUpperCase()}`;
}

/** Organisation prefix for the printed code, derived from the slug. */
export function organizationPrefix(slug: string): string {
  const letters = slug.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return (letters.slice(0, 4) || 'TAXI').padEnd(4, 'X');
}
