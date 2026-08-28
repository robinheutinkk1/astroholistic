import { describe, expect, it } from 'vitest';

/**
 * The redirect guard from signInAction, extracted so it can be tested without
 * a Next.js request context.
 *
 * An open redirect on a login form is a classic phishing vector: a link to the
 * real, trusted domain that lands the user on an attacker's page after signing
 * in. The rule is "relative paths only".
 */
function safeRedirect(next: string | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

describe('safeRedirect', () => {
  it('keeps a relative path', () => {
    expect(safeRedirect('/planning')).toBe('/planning');
  });

  it('keeps a nested relative path with a query string', () => {
    expect(safeRedirect('/rides/123?tab=events')).toBe('/rides/123?tab=events');
  });

  it('falls back to the dashboard when nothing is given', () => {
    expect(safeRedirect(undefined)).toBe('/dashboard');
    expect(safeRedirect('')).toBe('/dashboard');
  });

  it('refuses an absolute URL to another origin', () => {
    expect(safeRedirect('https://evil.example/steal')).toBe('/dashboard');
  });

  it('refuses a protocol-relative URL', () => {
    // '//evil.example' is the subtle one: it starts with '/' but the browser
    // reads it as a full origin.
    expect(safeRedirect('//evil.example/steal')).toBe('/dashboard');
  });

  it('refuses a javascript: URL', () => {
    expect(safeRedirect('javascript:alert(1)')).toBe('/dashboard');
  });

  it('refuses a backslash-prefixed path some browsers normalise', () => {
    expect(safeRedirect('\\\\evil.example')).toBe('/dashboard');
  });
});
