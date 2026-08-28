import { describe, expect, it } from 'vitest';
import {
  checkLogo,
  detectImageFormat,
  isValidBrandColor,
  logoObjectPath,
  MAX_LOGO_BYTES,
  normalizeBrandColor,
} from './image';

const bytes = (...values: number[]) => new Uint8Array(values);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);
const utf8 = (text: string) => new TextEncoder().encode(text);

describe('detectImageFormat', () => {
  it('recognises PNG, JPEG and WEBP by their magic bytes', () => {
    expect(detectImageFormat(PNG)).toBe('png');
    expect(detectImageFormat(JPEG)).toBe('jpeg');
    expect(detectImageFormat(WEBP)).toBe('webp');
  });

  it('recognises SVG even when it does not start with the tag', () => {
    // A BOM, an XML declaration or a comment before <svg> is perfectly valid
    // and would slip past a naive prefix check.
    expect(detectImageFormat(utf8('<svg xmlns="...">'))).toBe('svg');
    expect(detectImageFormat(utf8('<?xml version="1.0"?>\n<svg>'))).toBe('svg');
    expect(detectImageFormat(utf8('﻿  <!-- logo -->\n<SVG>'))).toBe('svg');
  });

  it('returns null for something that is not an image', () => {
    expect(detectImageFormat(utf8('just text'))).toBeNull();
    expect(detectImageFormat(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull(); // a zip
  });

  it('does not mistake a truncated RIFF header for WEBP', () => {
    expect(detectImageFormat(bytes(0x52, 0x49, 0x46, 0x46, 1, 2))).toBeNull();
  });
});

describe('checkLogo', () => {
  it('accepts a PNG', () => {
    const result = checkLogo(PNG);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contentType).toBe('image/png');
  });

  it('refuses an SVG with an explanation', () => {
    // Served from our own origin, a scripted SVG is stored XSS on every page of
    // that tenant — including the parent portal.
    const result = checkLogo(utf8('<svg onload="alert(1)"></svg>'));
    expect(result).toEqual({ ok: false, reason: 'SVG_NOT_ALLOWED' });
  });

  it('refuses an SVG renamed to .png', () => {
    // The whole point of reading bytes rather than trusting the declared type.
    expect(checkLogo(utf8('<svg><script>fetch("/steal")</script></svg>'))).toEqual({
      ok: false,
      reason: 'SVG_NOT_ALLOWED',
    });
  });

  it('refuses HTML disguised as an image', () => {
    expect(checkLogo(utf8('<html><script>alert(1)</script></html>'))).toEqual({
      ok: false,
      reason: 'UNSUPPORTED_FORMAT',
    });
  });

  it('refuses an empty file', () => {
    expect(checkLogo(new Uint8Array(0))).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it('refuses a file over the size limit', () => {
    const big = new Uint8Array(MAX_LOGO_BYTES + 1);
    big.set(PNG.slice(0, 8));
    expect(checkLogo(big)).toEqual({ ok: false, reason: 'TOO_LARGE' });
  });

  it('accepts a file exactly at the limit', () => {
    const exact = new Uint8Array(MAX_LOGO_BYTES);
    exact.set(PNG.slice(0, 8));
    expect(checkLogo(exact).ok).toBe(true);
  });
});

describe('logoObjectPath', () => {
  it('never uses the name the user supplied', () => {
    // A supplied name can carry path separators, a null byte, or a second
    // extension. The organisation id and the detected format are enough.
    const path = logoObjectPath('0a000000-0000-4000-8000-000000000000', 'png');
    expect(path).toBe('0a000000-0000-4000-8000-000000000000/logo.png');
    expect(path).not.toMatch(/\.\./);
  });
});

describe('brand colours', () => {
  it('accepts a six-digit hex value', () => {
    expect(isValidBrandColor('#1F47D6')).toBe(true);
    expect(normalizeBrandColor('  #1F47D6 ')).toBe('#1f47d6');
  });

  it('refuses anything that is not a literal hex value', () => {
    // These end up in a CSS custom property; in a white-label product that
    // stylesheet reaches the tenant's clients and parents too.
    expect(isValidBrandColor('red')).toBe(false);
    expect(isValidBrandColor('#fff')).toBe(false);
    expect(isValidBrandColor('#1f47d6; background: url(//evil)')).toBe(false);
    expect(isValidBrandColor('var(--x)')).toBe(false);
    expect(isValidBrandColor('expression(alert(1))')).toBe(false);
    expect(isValidBrandColor('')).toBe(false);
  });

  it('returns null rather than a partial value for bad input', () => {
    expect(normalizeBrandColor('#1f47d6}body{display:none')).toBeNull();
  });
});
