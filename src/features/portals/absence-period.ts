import { addDays, isLocalDate, type LocalDate } from '@/lib/datetime/timezone';

/**
 * Een periode-afmelding: "Jan is van 2 t/m 13 september niet mee" in één
 * verzoek, in plaats van tien losse afmeldingen per rit.
 *
 * De grenzen zijn bewust krap. Langer dan ~3 maanden of ver vooruit is geen
 * portaalverzoek meer maar een gesprek met de vervoerder — het contract of het
 * ritschema moet dan op de schop, en dat hoort niet ongezien in een wachtrij.
 */

/** Inclusief begin en eind: 92 dagen dekt een heel kwartaal of een zomervakantie. */
export const MAX_PERIOD_DAYS = 92;
/** Hoe ver vooruit een periode mag beginnen. */
export const MAX_START_AHEAD_DAYS = 180;

export interface AbsencePeriod {
  readonly from: LocalDate;
  readonly to: LocalDate;
}

export type AbsencePeriodResult =
  | { readonly ok: true; readonly period: AbsencePeriod }
  | { readonly ok: false; readonly message: string };

/** `2026-02-31` komt door de regex maar bestaat niet; de round-trip vangt dat. */
function isRealDate(value: string): boolean {
  if (!isLocalDate(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value;
}

function daysBetween(from: LocalDate, to: LocalDate): number {
  const at = (value: LocalDate) => {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/**
 * Valideert een opgegeven periode tegen "vandaag" in de tijdzone van de
 * organisatie. Alle meldingen zijn voor de indiener bedoeld: een ouder om
 * 23:00 met een telefoon in de hand, niet een ontwikkelaar met een stacktrace.
 */
export function validateAbsencePeriod(
  from: unknown,
  to: unknown,
  today: LocalDate,
): AbsencePeriodResult {
  if (typeof from !== 'string' || typeof to !== 'string' || !from || !to) {
    return { ok: false, message: 'Vul zowel de eerste als de laatste dag in.' };
  }
  if (!isRealDate(from) || !isRealDate(to)) {
    return { ok: false, message: 'Dat is geen geldige datum.' };
  }
  if (to < from) {
    return { ok: false, message: 'De laatste dag ligt vóór de eerste dag.' };
  }
  if (from < today) {
    return {
      ok: false,
      message:
        'De periode kan niet in het verleden beginnen. Gaat het om vandaag of eerder, meld dan per rit af of bel de vervoerder.',
    };
  }
  if (daysBetween(from, to) + 1 > MAX_PERIOD_DAYS) {
    return {
      ok: false,
      message:
        'Deze periode is langer dan drie maanden. Neem daarvoor contact op met de vervoerder, dan wordt het ritschema aangepast.',
    };
  }
  if (from > addDays(today, MAX_START_AHEAD_DAYS)) {
    return {
      ok: false,
      message:
        'De periode begint meer dan een half jaar vooruit. Geef hem dichter bij de tijd door, of bel de vervoerder.',
    };
  }
  return { ok: true, period: { from, to } };
}
