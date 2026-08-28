/**
 * Timezone helpers for ride scheduling (docs/ARCHITECTURE.md §8, decision D-07).
 *
 * A recurring ride is defined in *local wall-clock time*: "every weekday at
 * 08:00". Storing that as a UTC instant is wrong — after the DST change the bus
 * would leave an hour late. So the local date + time is authoritative, and the
 * absolute instant is derived from it using the organisation's timezone.
 *
 * Implemented with Intl rather than a date library: the platform already ships
 * the IANA database, and adding a dependency for this would be hard to justify
 * (masterprompt §67.12).
 */

/**
 * A calendar date in an organisation's local timezone, as `YYYY-MM-DD`.
 *
 * These are documentation aliases, not branded types: the functions below take
 * plain `string` and validate at the boundary, which keeps call sites readable
 * while still rejecting malformed input loudly.
 */
export type LocalDate = string;
/** A wall-clock time in an organisation's local timezone, as `HH:mm`. */
export type LocalTime = string;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Returns boolean rather than a `value is LocalDate` predicate on purpose:
 * LocalDate is an alias for string, so a type predicate would narrow the
 * negative branch to `never` and claim a guarantee it cannot give.
 */
export function isLocalDate(value: string): boolean {
  return DATE_PATTERN.test(value);
}

export function isLocalTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/**
 * Returns the timezone's UTC offset in minutes at a given instant.
 * Positive means ahead of UTC (Amsterdam is +60, or +120 in summer).
 */
function offsetMinutesAt(instant: Date, timeZone: string): number {
  // 'en-US' with these options yields a stable, parseable format across
  // runtimes; the locale only affects presentation, not the arithmetic.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(instant);
  const lookup = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part ? Number(part.value) : 0;
  };

  const asUtc = Date.UTC(
    lookup('year'),
    lookup('month') - 1,
    lookup('day'),
    // Intl renders midnight as hour 24 in some runtimes; normalise it.
    lookup('hour') % 24,
    lookup('minute'),
    lookup('second'),
  );

  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * Converts a local date and wall-clock time in `timeZone` to an absolute instant.
 *
 * Two edge cases matter, and both occur every year in Europe/Amsterdam:
 *
 * - **Spring forward**: 02:30 on the last Sunday of March does not exist. We
 *   resolve it to the instant the clock jumps to (03:00 local), so a ride is
 *   never silently dropped.
 * - **Autumn back**: 02:30 on the last Sunday of October happens twice. We
 *   resolve to the *first* (summer-time) occurrence, which is what a planner
 *   who wrote "02:30" means, and it keeps ride ordering stable.
 */
export function localToInstant(date: LocalDate, time: LocalTime, timeZone: string): Date {
  if (!isLocalDate(date)) throw new RangeError(`Invalid local date: ${date}`);
  if (!isLocalTime(time)) throw new RangeError(`Invalid local time: ${time}`);

  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = time.split(':').map(Number) as [number, number];

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const DAY_MS = 86_400_000;

  // Sample the offset a day either side so that a DST transition anywhere near
  // this local time is captured, whichever direction it goes.
  const candidateOffsets = [
    ...new Set([
      offsetMinutesAt(new Date(naiveUtc - DAY_MS), timeZone),
      offsetMinutesAt(new Date(naiveUtc), timeZone),
      offsetMinutesAt(new Date(naiveUtc + DAY_MS), timeZone),
    ]),
  ];

  // An offset is only a real answer if the instant it produces actually has
  // that offset. During a spring-forward gap no offset satisfies this; during
  // an autumn overlap two of them do.
  const validInstants = candidateOffsets
    .map((offset) => naiveUtc - offset * 60_000)
    .filter(
      (instant) =>
        offsetMinutesAt(new Date(instant), timeZone) === (naiveUtc - instant) / 60_000,
    )
    .sort((a, b) => a - b);

  const earliest = validInstants[0];
  if (earliest !== undefined) {
    // Overlap resolves to the earliest instant, i.e. the first (summer-time)
    // occurrence — which is what a planner who typed 02:30 means, and it keeps
    // ride ordering stable.
    return new Date(earliest);
  }

  // Gap: the requested wall-clock time does not exist. Shift forward using the
  // pre-transition offset, so 02:30 becomes 03:30 rather than disappearing.
  const offsetBefore = offsetMinutesAt(new Date(naiveUtc - DAY_MS), timeZone);
  return new Date(naiveUtc - offsetBefore * 60_000);
}

/** Formats an instant as the local calendar date in `timeZone`. */
export function instantToLocalDate(instant: Date, timeZone: string): LocalDate {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(instant);
}

/** Formats an instant as the local wall-clock time in `timeZone`. */
export function instantToLocalTime(instant: Date, timeZone: string): LocalTime {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatter.format(instant);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. Matches ride_templates.days_of_week. */
export function isoWeekday(date: string): number {
  if (!isLocalDate(date)) throw new RangeError(`Invalid local date: ${date}`);
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/** Adds whole days to a local date without any timezone involvement. */
export function addDays(date: string, days: number): LocalDate {
  if (!isLocalDate(date)) throw new RangeError(`Invalid local date: ${date}`);
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Today's calendar date in an organisation's timezone.
 *
 * "Today" must be the organisation's today, not the server's. A Vercel function
 * runs in UTC: at 00:30 Amsterdam time in summer it is still 22:30 the previous
 * day in UTC, so `new Date().toISOString().slice(0, 10)` would show the night
 * dispatcher yesterday's rides.
 */
export function todayInTimezone(timeZone: string, now: Date = new Date()): LocalDate {
  return instantToLocalDate(now, timeZone);
}
