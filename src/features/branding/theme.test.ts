import { describe, expect, it } from 'vitest';
import { brandName, brandStyle, showsPlatformBranding } from './theme';

describe('brandStyle', () => {
  it('maps valid colours onto the custom properties', () => {
    expect(brandStyle({ primary_color: '#1F47D6', secondary_color: '#0d9488' })).toEqual({
      '--tp-primary': '#1f47d6',
      '--tp-secondary': '#0d9488',
    });
  });

  it('returns nothing for no branding', () => {
    expect(brandStyle(null)).toEqual({});
    expect(brandStyle(undefined)).toEqual({});
  });

  it('drops a colour carrying a CSS payload', () => {
    // This is the shape that matters: a value that "starts with" a hex colour
    // and then closes the declaration to add its own. It must not survive.
    expect(
      brandStyle({ primary_color: '#1f47d6; background: url(//evil.example)' }),
    ).toEqual({});
  });

  it('drops a named colour and a function call', () => {
    expect(brandStyle({ primary_color: 'red' })).toEqual({});
    expect(brandStyle({ primary_color: 'var(--secret)' })).toEqual({});
  });

  it('keeps the valid half when only one colour is bad', () => {
    expect(brandStyle({ primary_color: '#123456', secondary_color: 'blue' })).toEqual({
      '--tp-primary': '#123456',
    });
  });

  it('drops shorthand hex, which the database also rejects', () => {
    expect(brandStyle({ primary_color: '#fff' })).toEqual({});
  });
});

describe('brandName', () => {
  it('prefers the display name', () => {
    expect(brandName({ display_name: 'Taxi Voorbeeld' }, 'Organisatie')).toBe(
      'Taxi Voorbeeld',
    );
  });

  it('falls back when the display name is blank', () => {
    expect(brandName({ display_name: '   ' }, 'Organisatie')).toBe('Organisatie');
    expect(brandName(null, 'Organisatie')).toBe('Organisatie');
  });
});

describe('showsPlatformBranding', () => {
  it('shows the platform line unless it is explicitly hidden', () => {
    expect(showsPlatformBranding(null)).toBe(true);
    expect(showsPlatformBranding({ hide_platform_branding: false })).toBe(true);
    expect(showsPlatformBranding({ hide_platform_branding: true })).toBe(false);
  });
});
