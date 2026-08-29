/**
 * Of de tagfunctie bruikbaar is op deze installatie.
 *
 * Bewust zonder `server-only`, en bewust los van de service: zo is deze regel
 * te testen. De service kan hem niet bevatten, want die is server-only en dan
 * is er geen test die faalt als de controle verdwijnt.
 *
 * Waarom de lengte hier staat en niet in env.server.ts: die module is óók
 * server-only, dus een gedeelde constante moet buiten allebei liggen. Dit is
 * de plek waar het getal thuishoort, want het is een eigenschap van de pepper
 * en niet van de omgevingslader.
 */
export const MIN_PEPPER_LENGTH = 32;

export function isTagFeatureConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const pepper = env['TAG_TOKEN_PEPPER'];
  // Ingevuld maar te kort is het lastige geval: de configuratie lijkt in orde
  // en het aanmaken faalde alsnog met een algemene fout.
  return typeof pepper === 'string' && pepper.length >= MIN_PEPPER_LENGTH;
}

/**
 * Is dit een tijdelijk adres van de hostingpartij?
 *
 * DIT IS GEEN COSMETISCHE VRAAG. De link die op een NFC-tag wordt geschreven,
 * of in een QR-code wordt geprint, bevat de hostnaam. Die staat daarna op een
 * fysiek kaartje in de auto of in de tas van een cliënt.
 *
 * Wie tags uitschrijft terwijl hier `iets.vercel.app` staat en later overstapt
 * naar het eigen domein, houdt een stapel tags over die naar het oude adres
 * blijven wijzen. Ze werken zolang dat adres blijft bestaan, en breken op de
 * dag dat het wordt opgeruimd — zonder waarschuwing, midden in een rit.
 *
 * Opnieuw uitschrijven kan alleen door elke tag opnieuw aan te maken: de code
 * is niet op te vragen, we bewaren alleen een versleutelde afdruk.
 */
export function isTemporaryHost(appUrl: string): boolean {
  try {
    const { hostname } = new URL(appUrl);
    return (
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.netlify.app') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    );
  } catch {
    // Een onleesbare URL is geen reden om te zwijgen: dan klopt er sowieso iets
    // niet aan de configuratie en mag de waarschuwing verschijnen.
    return true;
  }
}
