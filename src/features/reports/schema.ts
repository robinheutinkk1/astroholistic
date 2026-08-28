import { z } from 'zod';
import { addDays, isLocalDate, type LocalDate } from '@/lib/datetime/timezone';

/**
 * The reporting period.
 *
 * The upper bound is not arbitrary caution. These queries aggregate over
 * `rides`, and a planner who types 2019 into a date field would otherwise ask
 * for a full-table scan on every one of the five reports at once. 366 days
 * covers "the past year" — the longest period anyone actually asks for — and
 * anything larger is a job for an export, not a screen.
 */
export const MAX_PERIOD_DAYS = 366;

const localDate = z
  .string()
  .refine((value) => isLocalDate(value), 'Gebruik een datum in de vorm 2026-01-31.');

export const reportPeriodSchema = z
  .object({ from: localDate, to: localDate })
  .refine((value) => value.from <= value.to, {
    message: 'De einddatum ligt vóór de begindatum.',
    path: ['to'],
  })
  .refine((value) => daysBetween(value.from, value.to) <= MAX_PERIOD_DAYS, {
    message: `Kies een periode van maximaal ${MAX_PERIOD_DAYS} dagen.`,
    path: ['to'],
  });

export type ReportPeriod = z.infer<typeof reportPeriodSchema>;

/** Inclusive, so a single day is 1. ISO dates compare and subtract cleanly. */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * The period a planner sees when they open the screen: the last 30 days up to
 * and including yesterday. Today is excluded on purpose — half a day of rides
 * makes every percentage look wrong until the evening.
 */
export function defaultPeriod(today: LocalDate): ReportPeriod {
  const to = addDays(today, -1);
  return { from: addDays(to, -29), to };
}

/**
 * Parses a period from the URL, falling back to the default rather than
 * erroring. A hand-edited query string should not produce a broken screen.
 */
export function resolvePeriod(
  params: { from?: string | undefined; to?: string | undefined },
  today: LocalDate,
): ReportPeriod {
  const parsed = reportPeriodSchema.safeParse({ from: params.from, to: params.to });
  return parsed.success ? parsed.data : defaultPeriod(today);
}

export const REPORT_KINDS = ['per-dag', 'per-chauffeur', 'per-client'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  'per-dag': 'Ritten per dag',
  'per-chauffeur': 'Per chauffeur',
  'per-client': 'Per cliënt',
};
