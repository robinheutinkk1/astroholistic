import { describe, expect, it } from 'vitest';
import {
  csvFilename,
  escapeCell,
  formatCell,
  neutralizeFormula,
  toCsv,
  UTF8_BOM,
} from './csv';

describe('neutralizeFormula', () => {
  it('neutralises a formula', () => {
    expect(neutralizeFormula('=1+1')).toBe("'=1+1");
  });

  it('neutralises the shapes an attacker actually uses', () => {
    // A name field is the realistic entry point: whoever can get a name into
    // the system chooses what a planner's spreadsheet executes.
    expect(neutralizeFormula('=HYPERLINK("http://evil.example","klik")')).toBe(
      '\'=HYPERLINK("http://evil.example","klik")',
    );
    expect(neutralizeFormula('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizeFormula('+1-2')).toBe("'+1-2");
    expect(neutralizeFormula("-2+3+cmd|' /c calc'!A0")).toBe("'-2+3+cmd|' /c calc'!A0");
  });

  it('neutralises leading tab and carriage return', () => {
    // Both are stripped by spreadsheets before parsing, so `\t=1+1` becomes a
    // formula again unless it is caught here.
    expect(neutralizeFormula('\t=1+1')).toBe("'\t=1+1");
    expect(neutralizeFormula('\r=1+1')).toBe("'\r=1+1");
  });

  it('leaves a negative number alone', () => {
    // The exception that makes the rule usable: a delay of -120 seconds is
    // data, and quoting it would corrupt every negative figure in the export.
    expect(neutralizeFormula('-120')).toBe('-120');
    expect(neutralizeFormula('-12.5')).toBe('-12.5');
    expect(neutralizeFormula('-12,5')).toBe('-12,5');
  });

  it('leaves ordinary text alone', () => {
    expect(neutralizeFormula('Jan Jansen')).toBe('Jan Jansen');
    expect(neutralizeFormula('')).toBe('');
  });

  it('does not treat a formula-like string in the middle as dangerous', () => {
    expect(neutralizeFormula('Dagbesteding =De Es')).toBe('Dagbesteding =De Es');
  });
});

describe('escapeCell', () => {
  it('quotes a value containing the delimiter', () => {
    expect(escapeCell('Jansen; Jan')).toBe('"Jansen; Jan"');
  });

  it('doubles embedded quotes', () => {
    expect(escapeCell('Jan "Sjaan" Jansen')).toBe('"Jan ""Sjaan"" Jansen"');
  });

  it('quotes a value containing a newline', () => {
    expect(escapeCell('regel1\nregel2')).toBe('"regel1\nregel2"');
  });

  it('quotes a value with surrounding whitespace, which would otherwise be lost', () => {
    expect(escapeCell('  Jan  ')).toBe('"  Jan  "');
  });

  it('quotes *and* neutralises, in that order', () => {
    // The apostrophe must end up inside the quotes, not outside them.
    expect(escapeCell('=1;2')).toBe('"\'=1;2"');
  });
});

describe('formatCell', () => {
  it('renders null and undefined as empty', () => {
    expect(formatCell(null)).toBe('');
    expect(formatCell(undefined)).toBe('');
  });

  it('uses a comma as the decimal separator', () => {
    expect(formatCell(2.5)).toBe('2,5');
    expect(formatCell(-2.5)).toBe('-2,5');
  });

  it('renders a non-finite number as empty rather than "NaN"', () => {
    expect(formatCell(Number.NaN)).toBe('');
    expect(formatCell(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('toCsv', () => {
  it('writes a BOM, semicolons and CRLF', () => {
    const csv = toCsv(['Naam', 'Ritten'], [['Jan Jansen', 40]]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toBe(`${UTF8_BOM}Naam;Ritten\r\nJan Jansen;40\r\n`);
  });

  it('survives an empty result set', () => {
    expect(toCsv(['Naam'], [])).toBe(`${UTF8_BOM}Naam\r\n`);
  });
});

describe('csvFilename', () => {
  it('builds a readable name', () => {
    expect(csvFilename('Taxi Ontzorgd', '2026-01-01', '2026-01-31')).toBe(
      'taxi-ontzorgd-2026-01-01-tot-2026-01-31.csv',
    );
  });

  it('strips anything that could break the Content-Disposition header', () => {
    // The organisation name is user input and ends up in a response header.
    expect(csvFilename('Taxi "A"\r\nX-Injected: 1', '2026-01-01', '2026-01-02')).toBe(
      'taxi-a-x-injected-1-2026-01-01-tot-2026-01-02.csv',
    );
  });

  it('falls back when nothing usable is left', () => {
    expect(csvFilename('***', '2026-01-01', '2026-01-02')).toBe(
      'rapportage-2026-01-01-tot-2026-01-02.csv',
    );
  });
});
