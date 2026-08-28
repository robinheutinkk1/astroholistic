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
