import { describe, expect, it } from 'vitest';
import {
  IDLE_LIMIT_SECONDS,
  isExemptFromTimeout,
  isIdleExpired,
  stamp,
} from './session-timeout';

const NOW = 1_800_000_000;

describe('welke schermen de klok laten lopen', () => {
  it('de chauffeursapp is vrijgesteld', () => {
    expect(isExemptFromTimeout('/driver')).toBe(true);
    expect(isExemptFromTimeout('/driver/rit/123')).toBe(true);
    expect(isExemptFromTimeout('/driver/scan')).toBe(true);
  });

  it('de tagpagina ook, want die is publiek', () => {
    expect(isExemptFromTimeout('/t/ABC123')).toBe(true);
  });

  it('de plannerschermen niet', () => {
    for (const path of ['/dashboard', '/planning', '/clienten', '/rapportages']) {
      expect(isExemptFromTimeout(path), path).toBe(false);
    }
  });

  it('het portaal ook niet', () => {
    // Een ouder of zorgcoördinator kijkt mee in andermans dossier. Daar hoort
    // dezelfde regel te gelden als voor een planner.
    expect(isExemptFromTimeout('/portaal')).toBe(false);
    expect(isExemptFromTimeout('/portaal/123')).toBe(false);
  });

  it('een pad dat toevallig zo begint is niet vrijgesteld', () => {
    // `/drivers` is de plannerlijst met chauffeurs. Die mag niet meeliften op
    // de vrijstelling van `/driver`.
    expect(isExemptFromTimeout('/drivers')).toBe(false);
    expect(isExemptFromTimeout('/driverspaneel')).toBe(false);
    expect(isExemptFromTimeout('/tags')).toBe(false);
  });
});

describe('wanneer een sessie verloopt', () => {
  it('binnen de limiet blijft hij geldig', () => {
    expect(isIdleExpired(stamp(NOW - 60), NOW)).toBe(false);
    expect(isIdleExpired(stamp(NOW - IDLE_LIMIT_SECONDS + 1), NOW)).toBe(false);
  });

  it('precies op de limiet nog net niet', () => {
    expect(isIdleExpired(stamp(NOW - IDLE_LIMIT_SECONDS), NOW)).toBe(false);
  });

  it('erover wel', () => {
    expect(isIdleExpired(stamp(NOW - IDLE_LIMIT_SECONDS - 1), NOW)).toBe(true);
  });

  it('een nacht standby verloopt', () => {
    const zestienUur = 16 * 60 * 60;
    expect(isIdleExpired(stamp(NOW - zestienUur), NOW)).toBe(true);
  });

  it('een werkdag met klikken verloopt niet', () => {
    // De klok gaat bij elke aanvraag op nul. Een planner die de hele dag werkt
    // haalt de limiet nooit.
    let last = NOW;
    for (let minute = 0; minute < 8 * 60; minute += 20) {
      const now = NOW + minute * 60;
      expect(isIdleExpired(stamp(last), now)).toBe(false);
      last = now;
    }
  });

  it('een ontbrekende tijdstempel logt niemand uit', () => {
    /*
     * Dit is de regel die voorkomt dat het invoeren van deze functie iedereen
     * in één klap uitlogt, en dat een chauffeur die voor het eerst een
     * plannerpagina opent er meteen weer uit vliegt.
     */
    expect(isIdleExpired(undefined, NOW)).toBe(false);
  });

  it('een onleesbare tijdstempel ook niet', () => {
    for (const value of ['', 'gisteren', '-1', '0', 'NaN']) {
      expect(isIdleExpired(value, NOW), value).toBe(false);
    }
  });

  it('een tijdstempel uit de toekomst ook niet', () => {
    // Een klok die een paar seconden voorloopt mag geen uitlogronde starten.
    expect(isIdleExpired(stamp(NOW + 300), NOW)).toBe(false);
  });

  it('de limiet is instelbaar voor de test, niet magisch', () => {
    expect(isIdleExpired(stamp(NOW - 61), NOW, 60)).toBe(true);
    expect(isIdleExpired(stamp(NOW - 59), NOW, 60)).toBe(false);
  });
});
