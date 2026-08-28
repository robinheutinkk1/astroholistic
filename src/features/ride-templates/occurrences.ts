import { addDays, isoWeekday, type LocalDate } from '@/lib/datetime/timezone';

/**
 * Which dates a recurring ride falls on.
 *
 * Pure calendar arithmetic: no database, no timezone conversion. The generated
 * ride stores local wall-clock time (decision D-07), so the occurrence dates
 * themselves are timezone-independent — "every weekday" means the same set of
 * dates regardless of where the server runs.
 */
export interface RecurrenceRule {
  /** ISO weekdays: 1 = Monday … 7 = Sunday. */
  readonly daysOfWeek: readonly number[];
  readonly startsOn: LocalDate;
  readonly endsOn: LocalDate | null;
}

/**
 * Dates in [windowStart, windowEnd] on which the rule fires.
 *
 * Both bounds are inclusive. The window is clamped by the rule's own start and
 * end, so a template that ended last month generates nothing.
 */
export function computeOccurrences(
  rule: RecurrenceRule,
  windowStart: LocalDate,
  windowEnd: LocalDate,
): LocalDate[] {
  if (rule.daysOfWeek.length === 0) return [];

  const from = maxDate(rule.startsOn, windowStart);
  const to = rule.endsOn ? minDate(rule.endsOn, windowEnd) : windowEnd;
  if (from > to) return [];

  const wanted = new Set(rule.daysOfWeek);
  const dates: LocalDate[] = [];

  // A guard rather than a while(true): a corrupted rule must not spin forever
  // in a nightly job that nobody is watching.
  const MAX_DAYS = 400;
  let cursor = from;
  for (let i = 0; i <= MAX_DAYS && cursor <= to; i += 1) {
    if (wanted.has(isoWeekday(cursor))) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}

function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a < b ? a : b;
}

/** Human-readable summary of a recurrence, for the planning screens. */
const DAY_NAMES = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'] as const;

export function describeRecurrence(daysOfWeek: readonly number[]): string {
  const sorted = [...new Set(daysOfWeek)].sort((a, b) => a - b);
  if (sorted.length === 0) return 'Geen dagen gekozen';
  if (sorted.length === 7) return 'Elke dag';
  if (sorted.length === 5 && sorted.every((d) => d <= 5)) return 'Maandag t/m vrijdag';
  if (sorted.length === 2 && sorted[0] === 6 && sorted[1] === 7) return 'Weekend';
  return sorted.map((day) => DAY_NAMES[day - 1] ?? '?').join(', ');
}
