import { describe, expect, it } from 'vitest';
import { buildCsp, generateNonce } from './csp';

const SUPABASE = 'https://abcdefgh.supabase.co';

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split('; ').map((part) => {
      const [name, ...values] = part.split(' ');
      return [name ?? '', values];
    }),
  );
}

describe('buildCsp', () => {
  it('carries the nonce and strict-dynamic, and never unsafe-inline for scripts', () => {
    // unsafe-inline in script-src is the same as having no policy: it permits
    // exactly the injected script a CSP exists to stop.
    const csp = buildCsp({ nonce: 'abc123', supabaseUrl: SUPABASE });
    const script = directives(csp).get('script-src') ?? [];

    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(script).not.toContain('https:');
  });

  it('allows eval only in development', () => {
    const dev = directives(
      buildCsp({ nonce: 'n', supabaseUrl: SUPABASE, development: true }),
    );
    expect(dev.get('script-src')).toContain("'unsafe-eval'");
    // upgrade-insecure-requests would break the http dev server.
    expect(dev.has('upgrade-insecure-requests')).toBe(false);
  });

  it('upgrades insecure requests in production', () => {
    const csp = buildCsp({ nonce: 'n', supabaseUrl: SUPABASE });
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('permits the Supabase origin over both https and websocket', () => {
    // Realtime (fase 8) opens a WebSocket. Without the ws: origin the dispatch
    // board silently stops updating and nothing in the UI says why.
    const connect = directives(buildCsp({ nonce: 'n', supabaseUrl: SUPABASE })).get(
      'connect-src',
    );
    expect(connect).toContain('https://abcdefgh.supabase.co');
    expect(connect).toContain('wss://abcdefgh.supabase.co');
  });

  it('permits tenant logos from the Supabase origin', () => {
    const img = directives(buildCsp({ nonce: 'n', supabaseUrl: SUPABASE })).get(
      'img-src',
    );
    expect(img).toContain('https://abcdefgh.supabase.co');
  });

  it('locks down the directives that matter for a data product', () => {
    const map = directives(buildCsp({ nonce: 'n', supabaseUrl: SUPABASE }));
    expect(map.get('object-src')).toEqual(["'none'"]);
    expect(map.get('frame-ancestors')).toEqual(["'none'"]);
    expect(map.get('base-uri')).toEqual(["'self'"]);
    // form-action stops a stored payload posting the page's data elsewhere.
    expect(map.get('form-action')).toEqual(["'self'"]);
  });

  it('does not widen to everything when the Supabase URL is malformed', () => {
    // A missing or mistyped environment variable must fail closed. Falling back
    // to `*` here would be the quiet kind of misconfiguration nobody notices.
    const map = directives(buildCsp({ nonce: 'n', supabaseUrl: 'not-a-url' }));
    expect(map.get('connect-src')).toEqual(["'self'", "'none'", "'none'"]);
    expect(map.get('img-src')).not.toContain('*');
  });
});

describe('generateNonce', () => {
  it('produces a different value every time', () => {
    const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));
    expect(nonces.size).toBe(100);
  });

  it('produces at least 128 bits of base64', () => {
    // A guessable nonce is the same as no nonce.
    const nonce = generateNonce();
    expect(atob(nonce).length).toBe(16);
  });
});
