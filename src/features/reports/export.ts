import { toCsv, type CsvValue } from './csv';
import { type ClientRow, type DayRow, type DriverRow } from './repository';
import { type ReportKind } from './schema';

/**
 * Turning report rows into a CSV table.
 *
 * Pure, and separate from the route handler, so the column layout can be
 * asserted in a test rather than eyeballed in a downloaded file.
 *
 * `avg_delay_seconds` is rendered in whole seconds. Not minutes: a
 * two-and-a-half-minute average rounded to "3 minuten" is the kind of quiet
 * rounding that makes a punctuality figure argued about rather than used.
 */
export interface CsvTable {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly CsvValue[])[];
}

function seconds(value: number | null): CsvValue {
  return value === null ? null : Math.round(value);
}

/** A name we could not read is shown as such, never as an empty cell. */
const UNKNOWN_DRIVER = 'Onbekend / niet toegewezen';
const UNKNOWN_CLIENT = 'Onbekend';

export function perDayTable(rows: readonly DayRow[]): CsvTable {
  return {
    headers: ['Datum', 'Ritten', 'Afgerond', 'Afwezig', 'Geannuleerd'],
    rows: rows.map((row) => [
      row.day,
      row.total,
      row.completed,
      row.absent,
      row.cancelled,
    ]),
  };
}

export function perDriverTable(rows: readonly DriverRow[]): CsvTable {
  return {
    headers: [
      'Chauffeur',
      'Ritten',
      'Afgerond',
      'Afwezig',
      'Gemeten check-ins',
      'Op tijd',
      'Gemiddelde afwijking (seconden)',
    ],
    rows: rows.map((row) => [
      row.driverName ?? UNKNOWN_DRIVER,
      row.total,
      row.completed,
      row.absent,
      row.measured,
      row.onTime,
      seconds(row.avgDelaySeconds),
    ]),
  };
}

export function perClientTable(rows: readonly ClientRow[]): CsvTable {
  return {
    headers: ['Cliënt', 'Ritten', 'Afgerond', 'Afwezig', 'Geannuleerd', 'Laatste rit'],
    rows: rows.map((row) => [
      row.clientName ?? UNKNOWN_CLIENT,
      row.total,
      row.completed,
      row.absent,
      row.cancelled,
      row.lastRideDate,
    ]),
  };
}

export function tableToCsv(table: CsvTable): string {
  return toCsv(table.headers, table.rows);
}

export const EXPORT_LABELS: Record<ReportKind, string> = {
  'per-dag': 'ritten-per-dag',
  'per-chauffeur': 'per-chauffeur',
  'per-client': 'per-client',
};
