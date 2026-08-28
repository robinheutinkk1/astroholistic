import { describe, expect, it } from 'vitest';
import { classifyHost, normalizeHostname } from './host';

describe('normalizeHostname', () => {
  it('strips the port and lowercases', () => {
    expect(normalizeHostname('App.Example.NL:3000')).toBe('app.example.nl');
  });

  it('handles a bare hostname', () => {
    expect(normalizeHostname('example.nl')).toBe('example.nl');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeHostname('')).toBe('');
  });
});

describe('classifyHost', () => {
  const platform = 'app.tagpoint.nl';

  it('treats the configured platform host as platform', () => {
    expect(classifyHost('app.tagpoint.nl', platform)).toEqual({ kind: 'platform' });
  });

  it('treats localhost as platform so local dev needs no domain setup', () => {
    expect(classifyHost('localhost:3000', platform)).toEqual({ kind: 'platform' });
  });

  it('treats Vercel preview URLs as platform', () => {
    expect(classifyHost('tagpoint-git-main.vercel.app', platform)).toEqual({
      kind: 'platform',
    });
  });

  it('treats a tenant domain as custom', () => {
    expect(classifyHost('dispatch.taxi-ontzorgd.nl', platform)).toEqual({
      kind: 'custom',
      hostname: 'dispatch.taxi-ontzorgd.nl',
    });
  });

  it('does not treat a lookalike suffix as the platform host', () => {
    // 'nottagpoint.nl' must not match 'app.tagpoint.nl' through sloppy
    // endsWith matching — that would hand an attacker platform context.
    expect(classifyHost('app.nottagpoint.nl', platform)).toEqual({
      kind: 'custom',
      hostname: 'app.nottagpoint.nl',
    });
  });

  it('does not treat a domain merely containing vercel.app as platform', () => {
    expect(classifyHost('vercel.app.evil.nl', platform)).toEqual({
      kind: 'custom',
      hostname: 'vercel.app.evil.nl',
    });
  });

  it('falls back to platform for an empty host', () => {
    expect(classifyHost('', platform)).toEqual({ kind: 'platform' });
  });
});
