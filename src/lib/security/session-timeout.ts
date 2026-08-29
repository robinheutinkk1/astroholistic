/**
 * Automatisch uitloggen na te lang niets doen.
 *
 * TWEE SOORTEN GEBRUIK, TWEE ANTWOORDEN. Een planner werkt op een computer die
 * op kantoor blijft staan, vaak gedeeld, en die 's avonds aan blijft. Daar is
 * een sessie die eeuwig doorloopt een risico: wie morgenochtend als eerste
 * binnenkomt zit in de planning van zijn collega.
 *
 * Een chauffeur heeft de app als PWA op zijn eigen telefoon, met een
 * schermvergrendeling ervoor, en moet om zes uur 's ochtends in de kou met
 * handschoenen aan kunnen inchecken. Elke keer opnieuw inloggen is daar geen
 * beveiliging maar een reden om de app niet te gebruiken, en dan wordt er
 * helemaal niets meer geregistreerd.
 *
 * WAT DIT WEL EN NIET IS. Dit is een inactiviteitsslot voor een onbeheerd
 * scherm, geen autorisatiegrens. Wie de sessiecookie in handen heeft, heeft de
 * sessie; daar verandert een tijdstempel niets aan. De echte grens blijft RLS
 * en de permissiecontrole, en die staan hier los van.
 */

/** Hoe lang een sessie zonder activiteit blijft leven, buiten de chauffeursapp. */
export const IDLE_LIMIT_SECONDS = 4 * 60 * 60;

/** De cookie met het moment van de laatste activiteit. */
export const LAST_SEEN_COOKIE = 'tp_last_seen';

/**
 * Paden waar de klok niet loopt.
 *
 * Op pad en niet op rol, omdat de proxy bij elke aanvraag draait en het
 * opzoeken van een rol daar een databasevraag per klik zou kosten. Het gevolg
 * is te overzien: iemand die op een chauffeurspagina blijft staan houdt zijn
 * sessie in leven, maar zodra hij naar een plannerscherm gaat geldt de klok
 * weer — en die schermen zijn waar de planning staat.
 */
const EXEMPT_PREFIXES = ['/driver', '/t'];

export function isExemptFromTimeout(pathname: string): boolean {
  return EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Is deze sessie verlopen?
 *
 * Een ontbrekende of onleesbare tijdstempel betekent "nu net begonnen" en niet
 * "verlopen". Anders zou de eerste aanvraag na het invoeren van deze functie
 * iedereen uitloggen, en zou een chauffeur die voor het eerst een plannerpagina
 * opent er meteen weer uit vliegen.
 */
export function isIdleExpired(
  lastSeen: string | undefined,
  nowSeconds: number,
  limitSeconds: number = IDLE_LIMIT_SECONDS,
): boolean {
  if (lastSeen === undefined) return false;

  const parsed = Number(lastSeen);
  if (!Number.isFinite(parsed) || parsed <= 0) return false;

  // Een tijdstempel in de toekomst is onzin, maar mag nooit tot uitloggen
  // leiden: een klok die een paar seconden voorloopt is normaal.
  if (parsed > nowSeconds) return false;

  return nowSeconds - parsed > limitSeconds;
}

/** De waarde die na een geldige aanvraag in de cookie gaat. */
export function stamp(nowSeconds: number): string {
  return String(Math.floor(nowSeconds));
}
