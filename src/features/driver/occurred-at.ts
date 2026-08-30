/**
 * Het werkelijke moment van een chauffeurshandeling.
 *
 * Een check-in die offline is geregistreerd komt pas later bij de server aan.
 * Het datamodel maakt daarvoor al onderscheid tussen `occurred_at` (toen het
 * gebeurde) en `recorded_at` (toen de server het hoorde); tot nu toe waren die
 * altijd gelijk omdat alleen de server de klok las.
 *
 * De klem is de tegenhanger van het vertrouwen. Het tijdstip komt nu van het
 * toestel van de chauffeur en is dus invoer als alle andere:
 *
 * - Onleesbaar of afwezig betekent "nu". Een kapotte waarde mag een check-in
 *   nooit blokkeren of vervalsen.
 * - Meer dan twee minuten in de toekomst wordt "nu": dat is een scheve klok,
 *   geen tijdreis.
 * - Ouder dan een etmaal wordt op een etmaal geknepen. Langer dan een dienst
 *   offline is denkbaar; een registratie van vorige week antedateren niet.
 *
 * `recorded_at` blijft altijd de serverklok, dus het verschil tussen de twee
 * blijft zichtbaar in de administratie.
 */

export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const MAX_SKEW_MS = 2 * 60 * 1000;

export function clampOccurredAt(raw: unknown, now: Date = new Date()): Date {
  if (typeof raw !== 'string' || raw.length === 0) return now;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return now;

  const delta = now.getTime() - parsed.getTime();
  if (delta < -MAX_SKEW_MS) return now;
  if (delta > MAX_AGE_MS) return new Date(now.getTime() - MAX_AGE_MS);
  return parsed;
}
