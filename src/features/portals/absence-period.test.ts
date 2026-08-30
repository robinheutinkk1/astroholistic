import { describe, expect, it } from 'vitest';
import {
  MAX_PERIOD_DAYS,
  MAX_START_AHEAD_DAYS,
  validateAbsencePeriod,
} from './absence-period';
import { addDays } from '@/lib/datetime/timezone';

/**
 * De grenzen van de periode-afmelding. Elke afgewezen combinatie zou anders als
 * jsonb in change_requests belanden en pas bij de planning opvallen — of erger,
 * niet.
 */

const TODAY = '2026-08-30';

describe('validateAbsencePeriod', () => {
  it('accepteert een gewone vakantie', () => {
    const result = validateAbsencePeriod('2026-09-02', '2026-09-13', TODAY);
    expect(result).toEqual({
      ok: true,
      period: { from: '2026-09-02', to: '2026-09-13' },
    });
  });

  it('accepteert één dag, vandaag', () => {
    const result = validateAbsencePeriod(TODAY, TODAY, TODAY);
    expect(result.ok).toBe(true);
  });

  it('wijst een einde vóór het begin af', () => {
    const result = validateAbsencePeriod('2026-09-13', '2026-09-02', TODAY);
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('vóór') });
  });

  it('wijst een begin in het verleden af', () => {
    const result = validateAbsencePeriod('2026-08-29', '2026-09-02', TODAY);
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringContaining('verleden'),
    });
  });

  it(`staat precies ${MAX_PERIOD_DAYS} dagen toe en wijst één dag meer af`, () => {
    const exact = validateAbsencePeriod(
      TODAY,
      addDays(TODAY, MAX_PERIOD_DAYS - 1),
      TODAY,
    );
    expect(exact.ok).toBe(true);

    const over = validateAbsencePeriod(TODAY, addDays(TODAY, MAX_PERIOD_DAYS), TODAY);
    expect(over).toMatchObject({
      ok: false,
      message: expect.stringContaining('drie maanden'),
    });
  });

  it('wijst een begin verder dan de horizon af', () => {
    const start = addDays(TODAY, MAX_START_AHEAD_DAYS + 1);
    const result = validateAbsencePeriod(start, addDays(start, 5), TODAY);
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringContaining('vooruit'),
    });
  });

  it('wijst rommel af: lege velden, geen strings, niet-bestaande datums', () => {
    expect(validateAbsencePeriod('', '2026-09-02', TODAY).ok).toBe(false);
    expect(validateAbsencePeriod('2026-09-02', '', TODAY).ok).toBe(false);
    expect(validateAbsencePeriod(null, undefined, TODAY).ok).toBe(false);
    expect(validateAbsencePeriod(20260902, 20260913, TODAY).ok).toBe(false);
    expect(validateAbsencePeriod('02-09-2026', '13-09-2026', TODAY).ok).toBe(false);
    // Komt door de regex, bestaat niet op de kalender.
    expect(validateAbsencePeriod('2026-02-31', '2026-03-02', TODAY).ok).toBe(false);
  });
});
