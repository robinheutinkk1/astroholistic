import { describe, expect, it } from 'vitest';
import { perClientTable, perDayTable, perDriverTable, tableToCsv } from './export';
import { UTF8_BOM } from './csv';

describe('perDayTable', () => {
  it('lays out one row per day', () => {
    const table = perDayTable([
      { day: '2026-01-01', total: 4, completed: 3, absent: 1, cancelled: 0 },
    ]);
    expect(table.headers).toEqual([
      'Datum',
      'Ritten',
      'Afgerond',
      'Afwezig',
      'Geannuleerd',
    ]);
    expect(table.rows).toEqual([['2026-01-01', 4, 3, 1, 0]]);
  });
});

describe('perDriverTable', () => {
  it('rounds the average delay to whole seconds', () => {
    const table = perDriverTable([
      {
        driverId: 'd1',
        driverName: 'Kees Chauffeur',
        total: 10,
        completed: 9,
        absent: 1,
        measured: 9,
        onTime: 7,
        avgDelaySeconds: 166.4,
      },
    ]);
    expect(table.rows[0]).toEqual(['Kees Chauffeur', 10, 9, 1, 9, 7, 166]);
  });

  it('names an unreadable or unassigned driver instead of leaving a blank', () => {
    const table = perDriverTable([
      {
        driverId: null,
        driverName: null,
        total: 2,
        completed: 0,
        absent: 0,
        measured: 0,
        onTime: 0,
        avgDelaySeconds: null,
      },
    ]);
    expect(table.rows[0]?.[0]).toBe('Onbekend / niet toegewezen');
    expect(table.rows[0]?.[6]).toBeNull();
  });
});

describe('perClientTable', () => {
  it('carries a name that would otherwise be executed by a spreadsheet', () => {
    // End to end: a hostile client name reaches the CSV neutralised.
    const table = perClientTable([
      {
        clientId: 'c1',
        clientName: "=cmd|' /c calc'!A0",
        total: 1,
        completed: 1,
        absent: 0,
        cancelled: 0,
        lastRideDate: '2026-01-02',
      },
    ]);
    const csv = tableToCsv(table);
    expect(csv).toContain("'=cmd");
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
  });
});
