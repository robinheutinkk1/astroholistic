import { describe, expect, it } from 'vitest';
import { clampOccurredAt, MAX_AGE_MS } from './occurred-at';

const NOW = new Date('2026-08-30T12:00:00.000Z');

describe('het werkelijke moment van een handeling', () => {
  it('een gewone waarde van net geleden blijft staan', () => {
    const clicked = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(clampOccurredAt(clicked, NOW).toISOString()).toBe(clicked);
  });

  it('afwezig of onleesbaar betekent nu, nooit een fout', () => {
    // Een kapotte waarde mag een check-in niet blokkeren of vervalsen.
    for (const raw of [undefined, null, '', 'gisteren', 42, {}]) {
      expect(clampOccurredAt(raw, NOW)).toBe(NOW);
    }
  });

  it('een klok die iets voorloopt is geen tijdreis', () => {
    const slightlyAhead = new Date(NOW.getTime() + 30 * 1000).toISOString();
    expect(clampOccurredAt(slightlyAhead, NOW).toISOString()).toBe(slightlyAhead);
  });

  it('ver in de toekomst wordt nu', () => {
    const future = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
    expect(clampOccurredAt(future, NOW)).toBe(NOW);
  });

  it('ouder dan een etmaal wordt op een etmaal geknepen', () => {
    // Antedateren naar vorige week kan niet, ook niet via de wachtrij.
    const lastWeek = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(clampOccurredAt(lastWeek, NOW).getTime()).toBe(NOW.getTime() - MAX_AGE_MS);
  });

  it('een hele dienst offline blijft binnen het venster gewoon geldig', () => {
    const tenHoursAgo = new Date(NOW.getTime() - 10 * 60 * 60 * 1000).toISOString();
    expect(clampOccurredAt(tenHoursAgo, NOW).toISOString()).toBe(tenHoursAgo);
  });
});
