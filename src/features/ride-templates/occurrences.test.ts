import { describe, expect, it } from 'vitest';
import { computeOccurrences, describeRecurrence } from './occurrences';

const WEEKDAYS = [1, 2, 3, 4, 5];

describe('computeOccurrences', () => {
  it('generates weekdays only, skipping the weekend', () => {
    // 2026-08-24 is a Monday.
    const dates = computeOccurrences(
      { daysOfWeek: WEEKDAYS, startsOn: '2026-08-24', endsOn: null },
      '2026-08-24',
      '2026-08-30',
    );
    expect(dates).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
    ]);
  });

  it('handles a single weekday', () => {
    const dates = computeOccurrences(
      { daysOfWeek: [3], startsOn: '2026-08-01', endsOn: null },
      '2026-08-24',
      '2026-09-14',
    );
    expect(dates).toEqual(['2026-08-26', '2026-09-02', '2026-09-09']);
  });

  it('does not start before the template starts', () => {
    const dates = computeOccurrences(
      { daysOfWeek: WEEKDAYS, startsOn: '2026-08-26', endsOn: null },
      '2026-08-24',
      '2026-08-28',
    );
    expect(dates).toEqual(['2026-08-26', '2026-08-27', '2026-08-28']);
  });

  it('stops at the template end date', () => {
    const dates = computeOccurrences(
      { daysOfWeek: WEEKDAYS, startsOn: '2026-08-24', endsOn: '2026-08-26' },
      '2026-08-24',
      '2026-08-31',
    );
    expect(dates).toEqual(['2026-08-24', '2026-08-25', '2026-08-26']);
  });

  it('generates nothing for a template that already ended', () => {
    const dates = computeOccurrences(
      { daysOfWeek: WEEKDAYS, startsOn: '2026-01-01', endsOn: '2026-06-30' },
      '2026-08-24',
      '2026-08-31',
    );
    expect(dates).toEqual([]);
  });

  it('generates nothing for a template that has not started yet', () => {
    const dates = computeOccurrences(
      { daysOfWeek: WEEKDAYS, startsOn: '2027-01-01', endsOn: null },
      '2026-08-24',
      '2026-08-31',
    );
    expect(dates).toEqual([]);
  });

  it('generates nothing when no days are selected', () => {
    const dates = computeOccurrences(
      { daysOfWeek: [], startsOn: '2026-08-24', endsOn: null },
      '2026-08-24',
      '2026-08-31',
    );
    expect(dates).toEqual([]);
  });

  it('includes both bounds of the window', () => {
    const dates = computeOccurrences(
      { daysOfWeek: [1, 2, 3, 4, 5, 6, 7], startsOn: '2026-08-24', endsOn: null },
      '2026-08-24',
      '2026-08-26',
    );
    expect(dates).toEqual(['2026-08-24', '2026-08-25', '2026-08-26']);
  });

  it('crosses a month boundary', () => {
    const dates = computeOccurrences(
      { daysOfWeek: [1], startsOn: '2026-08-01', endsOn: null },
      '2026-08-28',
      '2026-09-08',
    );
    expect(dates).toEqual(['2026-08-31', '2026-09-07']);
  });

  it('crosses a year boundary', () => {
    const dates = computeOccurrences(
      { daysOfWeek: [5], startsOn: '2026-01-01', endsOn: null },
      '2026-12-28',
      '2027-01-10',
    );
    expect(dates).toEqual(['2027-01-01', '2027-01-08']);
  });

  it('handles a leap day', () => {
    const dates = computeOccurrences(
      { daysOfWeek: [2], startsOn: '2028-02-01', endsOn: null },
      '2028-02-26',
      '2028-03-01',
    );
    // 29 February 2028 is a Tuesday.
    expect(dates).toEqual(['2028-02-29']);
  });

  it('is unaffected by the DST change', () => {
    // 2026-03-29 is the spring-forward Sunday. Occurrence dates are pure
    // calendar maths; the clock change only affects the ride's timestamp.
    const dates = computeOccurrences(
      { daysOfWeek: [7], startsOn: '2026-03-01', endsOn: null },
      '2026-03-22',
      '2026-04-05',
    );
    expect(dates).toEqual(['2026-03-22', '2026-03-29', '2026-04-05']);
  });

  it('returns nothing when the window is inverted', () => {
    expect(
      computeOccurrences(
        { daysOfWeek: WEEKDAYS, startsOn: '2026-08-01', endsOn: null },
        '2026-08-31',
        '2026-08-24',
      ),
    ).toEqual([]);
  });

  it('caps at a sane number of days rather than looping forever', () => {
    const dates = computeOccurrences(
      { daysOfWeek: [1, 2, 3, 4, 5, 6, 7], startsOn: '2026-01-01', endsOn: null },
      '2026-01-01',
      '2030-01-01',
    );
    expect(dates.length).toBeLessThanOrEqual(401);
  });
});

describe('describeRecurrence', () => {
  it('recognises the working week', () => {
    expect(describeRecurrence([1, 2, 3, 4, 5])).toBe('Maandag t/m vrijdag');
  });

  it('recognises every day', () => {
    expect(describeRecurrence([1, 2, 3, 4, 5, 6, 7])).toBe('Elke dag');
  });

  it('recognises the weekend', () => {
    expect(describeRecurrence([6, 7])).toBe('Weekend');
  });

  it('lists individual days in order', () => {
    expect(describeRecurrence([3, 1])).toBe('ma, wo');
  });

  it('handles duplicates', () => {
    expect(describeRecurrence([1, 1, 3])).toBe('ma, wo');
  });

  it('says so when nothing is selected', () => {
    expect(describeRecurrence([])).toBe('Geen dagen gekozen');
  });
});
