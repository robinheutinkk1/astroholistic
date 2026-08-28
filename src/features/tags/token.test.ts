import { describe, expect, it } from 'vitest';
import {
  encodeBase32,
  formatPublicCode,
  isPlausibleToken,
  normalizeToken,
  organizationPrefix,
  TOKEN_BYTES,
  TOKEN_LENGTH,
} from './token';

describe('encodeBase32', () => {
  it('produces the documented length for 16 bytes', () => {
    const bytes = new Uint8Array(TOKEN_BYTES).fill(0);
    expect(encodeBase32(bytes)).toHaveLength(TOKEN_LENGTH);
  });

  it('never emits the ambiguous characters', () => {
    // I, L, O and U are excluded so a code read over the phone is unambiguous.
    const bytes = new Uint8Array(TOKEN_BYTES).map((_, index) => index * 17);
    expect(encodeBase32(bytes)).not.toMatch(/[ILOU]/);
  });

  it('is deterministic for the same input', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(encodeBase32(bytes)).toBe(encodeBase32(bytes));
  });

  it('produces different output for different input', () => {
    const a = encodeBase32(new Uint8Array(TOKEN_BYTES).fill(0));
    const b = encodeBase32(new Uint8Array(TOKEN_BYTES).fill(255));
    expect(a).not.toBe(b);
  });
});

describe('normalizeToken', () => {
  it('uppercases and strips spaces and dashes', () => {
    expect(normalizeToken(' abc-def 123 ')).toBe('ABCDEF123');
  });

  it('maps look-alike characters onto their canonical form', () => {
    // Someone reading a label writes O for zero and I for one.
    expect(normalizeToken('O0I1L')).toBe('00111');
    expect(normalizeToken('U')).toBe('V');
    expect(normalizeToken('Q')).toBe('0');
  });

  it('is idempotent', () => {
    const once = normalizeToken('o0i1l-u');
    expect(normalizeToken(once)).toBe(once);
  });
});

describe('isPlausibleToken', () => {
  const valid = 'ABCDEFGHJKMNPQRSTVWXYZ0123';

  it('accepts a well-formed token', () => {
    expect(valid).toHaveLength(TOKEN_LENGTH);
    expect(isPlausibleToken(valid)).toBe(true);
  });

  it('accepts a token typed with lower case and dashes', () => {
    expect(isPlausibleToken('abcdefgh-jkmn-pqrstvwxyz-0123')).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isPlausibleToken('ABC')).toBe(false);
    expect(isPlausibleToken(valid + 'X')).toBe(false);
  });

  it('rejects characters outside the alphabet', () => {
    expect(isPlausibleToken('!'.repeat(TOKEN_LENGTH))).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isPlausibleToken('')).toBe(false);
  });

  it('cheaply rejects an obvious probe before any database work', () => {
    // The landing page checks this first: a scan of "../../etc/passwd" should
    // not cost a query.
    expect(isPlausibleToken('../../etc/passwd')).toBe(false);
    expect(isPlausibleToken("'; drop table nfc_tags; --")).toBe(false);
  });
});

describe('public codes', () => {
  it('formats a readable label code', () => {
    expect(formatPublicCode('taxi', '8f3a21')).toBe('TP-TAXI-8F3A21');
  });

  it('derives a prefix from an organisation slug', () => {
    expect(organizationPrefix('taxi-ontzorgd-demo')).toBe('TAXI');
    expect(organizationPrefix('voorbeeldtaxi')).toBe('VOOR');
  });

  it('pads a short slug rather than producing a stub', () => {
    expect(organizationPrefix('ab')).toBe('ABXX');
  });

  it('falls back when a slug has no letters at all', () => {
    expect(organizationPrefix('123-456')).toBe('TAXI');
  });
});
