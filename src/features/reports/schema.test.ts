import { describe, expect, it } from 'vitest';
import {
  MAX_PERIOD_DAYS,
  daysBetween,
  defaultPeriod,
  reportPeriodSchema,
  resolvePeriod,
} from './schema';

describe('daysBetween', () => {
  it('counts inclusively', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(1);
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(31);
  });

  it('counts across a DST change', () => {
    // 2026-03-29 is the spring-forward night in Amsterdam. Counting in UTC is
    // what keeps this 31 rather than 30.97 rounded down to 30.
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(31);
  });

  it('counts across a leap day', () => {
    expect(daysBetween('2024-02-01', '2024-03-01')).toBe(30);
  });
});

describe('reportPeriodSchema', () => {
  it('accepts a normal period', () => {
    expect(
      reportPeriodSchema.safeParse({ from: '2026-01-01', to: '2026-01-31' }).success,
    ).toBe(true);
  });

  it('accepts a single day', () => {
    expect(
      reportPeriodSchema.safeParse({ from: '2026-01-05', to: '2026-01-05' }).success,
    ).toBe(true);
  });

  it('rejects a reversed period', () => {
    const result = reportPeriodSchema.safeParse({ from: '2026-02-01', to: '2026-01-01' });
    expect(result.success).toBe(false);
  });

  it('rejects a period longer than the cap', () => {
    // The cap is not politeness: without it one mistyped year runs five
    // aggregate queries over the whole rides table at once.
    const result = reportPeriodSchema.safeParse({ from: '2020-01-01', to: '2026-01-01' });
    expect(result.success).toBe(false);
  });

  it('accepts exactly the cap and rejects one day more', () => {
    // 2024 is a leap year, so 1 January to 31 December is exactly 366 days.
    expect(daysBetween('2024-01-01', '2024-12-31')).toBe(MAX_PERIOD_DAYS);
    expect(
      reportPeriodSchema.safeParse({ from: '2024-01-01', to: '2024-12-31' }).success,
    ).toBe(true);
    expect(
      reportPeriodSchema.safeParse({ from: '2024-01-01', to: '2025-01-01' }).success,
    ).toBe(false);
  });

  it('rejects something that is not a date', () => {
    expect(
      reportPeriodSchema.safeParse({ from: 'gisteren', to: 'vandaag' }).success,
    ).toBe(false);
    expect(
      reportPeriodSchema.safeParse({ from: '2026-13-01', to: '2026-13-02' }).success,
    ).toBe(false);
  });
});

describe('defaultPeriod', () => {
  it('ends yesterday and covers thirty days', () => {
    // Today is excluded: a half-finished day makes every percentage look wrong
    // until the evening.
    expect(defaultPeriod('2026-03-15')).toEqual({ from: '2026-02-13', to: '2026-03-14' });
    expect(daysBetween('2026-02-13', '2026-03-14')).toBe(30);
  });

  it('crosses a year boundary', () => {
    expect(defaultPeriod('2026-01-05')).toEqual({ from: '2025-12-06', to: '2026-01-04' });
    expect(daysBetween('2025-12-06', '2026-01-04')).toBe(30);
  });
});

describe('resolvePeriod', () => {
  it('uses the query string when it is valid', () => {
    expect(resolvePeriod({ from: '2026-01-01', to: '2026-01-31' }, '2026-03-15')).toEqual(
      {
        from: '2026-01-01',
        to: '2026-01-31',
      },
    );
  });

  it('falls back to the default on rubbish rather than erroring', () => {
    // A hand-edited or truncated link should show a working screen, not a
    // crash — this is a read-only report, not a form.
    expect(resolvePeriod({ from: 'x', to: 'y' }, '2026-03-15')).toEqual(
      defaultPeriod('2026-03-15'),
    );
    expect(resolvePeriod({}, '2026-03-15')).toEqual(defaultPeriod('2026-03-15'));
  });

  it('falls back when the period is too long', () => {
    expect(resolvePeriod({ from: '2000-01-01', to: '2026-01-01' }, '2026-03-15')).toEqual(
      defaultPeriod('2026-03-15'),
    );
  });
});
