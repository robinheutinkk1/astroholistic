import { describe, expect, it } from 'vitest';
import {
  addDays,
  instantToLocalDate,
  instantToLocalTime,
  isoWeekday,
  localToInstant,
} from './timezone';

const AMS = 'Europe/Amsterdam';

describe('localToInstant', () => {
  it('resolves a winter-time morning correctly (UTC+1)', () => {
    expect(localToInstant('2026-01-15', '08:00', AMS).toISOString()).toBe(
      '2026-01-15T07:00:00.000Z',
    );
  });

  it('resolves a summer-time morning correctly (UTC+2)', () => {
    expect(localToInstant('2026-07-15', '08:00', AMS).toISOString()).toBe(
      '2026-07-15T06:00:00.000Z',
    );
  });

  /**
   * The reason this whole module exists (decision D-07). A recurring ride at
   * 08:00 must stay at 08:00 on the clock across the DST switch. Storing a
   * fixed UTC instant would move it by an hour and the bus would arrive late.
   */
  it('keeps a recurring 08:00 pickup at 08:00 local across the DST change', () => {
    const beforeSwitch = localToInstant('2026-03-28', '08:00', AMS);
    const afterSwitch = localToInstant('2026-03-30', '08:00', AMS);

    expect(instantToLocalTime(beforeSwitch, AMS)).toBe('08:00');
    expect(instantToLocalTime(afterSwitch, AMS)).toBe('08:00');

    // Same wall-clock time, but one hour less elapsed UTC time: 48h - 1h.
    const elapsedHours = (afterSwitch.getTime() - beforeSwitch.getTime()) / 3_600_000;
    expect(elapsedHours).toBe(47);
  });

  it('resolves a non-existent spring-forward time to a real instant', () => {
    // 02:30 on 2026-03-29 does not exist in Amsterdam; the clock jumps 02:00→03:00.
    const instant = localToInstant('2026-03-29', '02:30', AMS);
    expect(Number.isNaN(instant.getTime())).toBe(false);
    expect(instantToLocalDate(instant, AMS)).toBe('2026-03-29');
    expect(instantToLocalTime(instant, AMS)).toBe('03:30');
  });

  it('resolves an ambiguous autumn time to the first (summer-time) occurrence', () => {
    // 02:30 on 2026-10-25 happens twice in Amsterdam.
    const instant = localToInstant('2026-10-25', '02:30', AMS);
    expect(instant.toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(instantToLocalTime(instant, AMS)).toBe('02:30');
  });

  it('handles a timezone on the other side of UTC', () => {
    expect(localToInstant('2026-01-15', '08:00', 'America/New_York').toISOString()).toBe(
      '2026-01-15T13:00:00.000Z',
    );
  });

  it('round-trips through the local date and time', () => {
    const instant = localToInstant('2026-11-03', '16:45', AMS);
    expect(instantToLocalDate(instant, AMS)).toBe('2026-11-03');
    expect(instantToLocalTime(instant, AMS)).toBe('16:45');
  });

  it('rejects malformed input rather than guessing', () => {
    expect(() => localToInstant('15-01-2026', '08:00', AMS)).toThrow(RangeError);
    expect(() => localToInstant('2026-01-15', '8:00', AMS)).toThrow(RangeError);
    expect(() => localToInstant('2026-01-15', '24:00', AMS)).toThrow(RangeError);
  });
});

describe('isoWeekday', () => {
  it('returns 1 for Monday and 7 for Sunday', () => {
    expect(isoWeekday('2026-08-24')).toBe(1);
    expect(isoWeekday('2026-08-30')).toBe(7);
  });

  it('covers a full week', () => {
    const week = [
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ];
    expect(week.map(isoWeekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('is unaffected by the DST change, since it is pure calendar maths', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
  });

  it('subtracts with a negative offset', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});
