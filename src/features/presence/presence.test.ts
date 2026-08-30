import { describe, expect, it } from 'vitest';
import { countPresence, presenceOf } from './presence';

/**
 * De vertaling van ritstatus naar "is Jan er al". Elke verkeerde emmer is een
 * begeleider die onnodig gaat bellen, of erger: niet gaat bellen.
 */
describe('van ritstatus naar aanwezigheid', () => {
  it('aangekomen en afgerond betekenen aanwezig', () => {
    expect(presenceOf('ARRIVED')).toBe('PRESENT');
    expect(presenceOf('COMPLETED')).toBe('PRESENT');
  });

  it('ingecheckt en rijdend betekenen onderweg', () => {
    expect(presenceOf('CLIENT_CHECKED_IN')).toBe('EN_ROUTE');
    expect(presenceOf('TRIP_STARTED')).toBe('EN_ROUTE');
  });

  it('alles voor het instappen is verwacht', () => {
    for (const status of [
      'SCHEDULED',
      'DRIVER_ASSIGNED',
      'DRIVER_EN_ROUTE',
      'DRIVER_ARRIVED',
    ] as const) {
      expect(presenceOf(status), status).toBe('EXPECTED');
    }
  });

  it('afwezig en geannuleerd zijn eigen emmers', () => {
    expect(presenceOf('CLIENT_ABSENT')).toBe('ABSENT');
    expect(presenceOf('CANCELLED')).toBe('CANCELLED');
  });

  it('een probleem telt als onderweg, niet als aanwezig', () => {
    // "Er is iets" mag nooit als "hij is er" op het bord staan.
    expect(presenceOf('PROBLEM')).toBe('EN_ROUTE');
  });
});

describe('de telling boven het bord', () => {
  it('telt per emmer en laat annuleringen uit het totaal', () => {
    const counts = countPresence([
      'ARRIVED',
      'COMPLETED',
      'CLIENT_CHECKED_IN',
      'DRIVER_ASSIGNED',
      'CLIENT_ABSENT',
      'CANCELLED',
    ]);

    expect(counts).toEqual({
      total: 5,
      present: 2,
      enRoute: 1,
      expected: 1,
      absent: 1,
      cancelled: 1,
    });
  });

  it('een lege dag is nul, geen deling door nul', () => {
    expect(countPresence([]).total).toBe(0);
  });
});
