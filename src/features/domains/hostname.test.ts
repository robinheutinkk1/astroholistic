import { describe, expect, it } from 'vitest';
import {
  checkHostname,
  normalizeHostname,
  verificationRecordName,
  verificationRecordValue,
} from './hostname';

const PLATFORM = 'app.tagpoint.test';

describe('normalizeHostname', () => {
  it('lowercases', () => {
    expect(normalizeHostname('Vervoer.Voorbeeld.NL')).toBe('vervoer.voorbeeld.nl');
  });

  it('strips a port', () => {
    expect(normalizeHostname('voorbeeld.nl:3000')).toBe('voorbeeld.nl');
  });

  it('strips the DNS root dot', () => {
    // "voorbeeld.nl." is the fully qualified form of the same host. Left in, it
    // would be a second string resolving to the same site.
    expect(normalizeHostname('voorbeeld.nl.')).toBe('voorbeeld.nl');
  });

  it('strips a scheme and path that a user pasted from the address bar', () => {
    expect(normalizeHostname('https://voorbeeld.nl/planning')).toBe('voorbeeld.nl');
  });
});

describe('checkHostname', () => {
  it('accepts a normal subdomain', () => {
    expect(checkHostname('vervoer.voorbeeld.nl', PLATFORM)).toEqual({
      ok: true,
      hostname: 'vervoer.voorbeeld.nl',
    });
  });

  it('normalizes before accepting', () => {
    expect(checkHostname('  VERVOER.Voorbeeld.NL.:443 ', PLATFORM)).toEqual({
      ok: true,
      hostname: 'vervoer.voorbeeld.nl',
    });
  });

  it('rejects an empty value', () => {
    expect(checkHostname('   ', PLATFORM)).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it('rejects a single label', () => {
    expect(checkHostname('intranet', PLATFORM)).toEqual({
      ok: false,
      reason: 'NOT_A_DOMAIN',
    });
  });

  it('rejects a label with an underscore', () => {
    expect(checkHostname('mijn_vervoer.nl', PLATFORM)).toEqual({
      ok: false,
      reason: 'INVALID',
    });
  });

  it('rejects a leading hyphen', () => {
    expect(checkHostname('-vervoer.nl', PLATFORM)).toEqual({
      ok: false,
      reason: 'INVALID',
    });
  });

  it('rejects the platform host itself', () => {
    expect(checkHostname(PLATFORM, PLATFORM)).toEqual({ ok: false, reason: 'RESERVED' });
  });

  it('rejects a subdomain of the platform host', () => {
    // Tenant subdomains are handed out by the platform. If an organisation
    // could *claim* one, they could verify a hostname that already routes to a
    // different tenant's site.
    expect(checkHostname('andere-klant.app.tagpoint.test', PLATFORM)).toEqual({
      ok: false,
      reason: 'RESERVED',
    });
  });

  it('does not treat a lookalike suffix as the platform host', () => {
    // "notapp.tagpoint.test" ends with "tagpoint.test" but is not a subdomain
    // of "app.tagpoint.test", so it is a legitimate claim.
    expect(checkHostname('notapp.tagpoint.test', PLATFORM).ok).toBe(true);
  });

  it('rejects localhost', () => {
    expect(checkHostname('localhost', PLATFORM)).toEqual({
      ok: false,
      reason: 'NOT_A_DOMAIN',
    });
  });

  it('rejects a hostname over 253 characters', () => {
    const long = `${'a'.repeat(60)}.`.repeat(5) + 'nl';
    expect(checkHostname(long, PLATFORM)).toEqual({ ok: false, reason: 'TOO_LONG' });
  });
});

describe('verification record', () => {
  it('is published on a dedicated subdomain', () => {
    expect(verificationRecordName('vervoer.voorbeeld.nl')).toBe(
      '_tagpoint-verify.vervoer.voorbeeld.nl',
    );
  });

  it('is prefixed so an unrelated TXT record cannot match by accident', () => {
    expect(verificationRecordValue('abc123')).toBe('tagpoint-domain-verification=abc123');
  });
});
