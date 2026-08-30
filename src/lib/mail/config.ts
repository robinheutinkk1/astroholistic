/**
 * Welk mailkanaal deze installatie heeft, en of het compleet is.
 *
 * Los van de verzender zelf en zonder `server-only`, zodat de regel testbaar
 * is. Dezelfde reden als bij de tag-pepper: een controle die alleen in
 * server-only-code leeft, heeft geen test die faalt als hij verdwijnt.
 *
 * WAAROM DIT NAAST SUPABASE BESTAAT. Supabase verstuurt alleen zijn eigen
 * auth-mails (uitnodiging, wachtwoordherstel) en kent de applicatie niet.
 * Alles wat het product zélf wil zeggen — "je verzoek is goedgekeurd", straks
 * het dagrapport — heeft een eigen kanaal nodig.
 */

export interface MailConfig {
  readonly provider: 'resend';
  readonly apiKey: string;
  /** Bijvoorbeeld: "Tagpoint <noreply@taxi.tagpoint.nl>". */
  readonly from: string;
}

export type MailConfigResult =
  | { readonly configured: true; readonly config: MailConfig }
  | { readonly configured: false; readonly reason: string };

export function resolveMailConfig(
  env: Record<string, string | undefined> = process.env,
): MailConfigResult {
  const provider = env['MAIL_PROVIDER'];

  // Geen provider is een geldige toestand, geen kapotte: een verse
  // installatie moet kunnen draaien zonder mailkanaal, en elke plek die wil
  // versturen hoort dat zichtbaar te melden in plaats van stil te falen.
  if (!provider) return { configured: false, reason: 'MAIL_PROVIDER is niet gezet' };

  if (provider !== 'resend') {
    return { configured: false, reason: `onbekende MAIL_PROVIDER "${provider}"` };
  }

  const apiKey = env['MAIL_API_KEY'];
  if (!apiKey) return { configured: false, reason: 'MAIL_API_KEY is niet gezet' };

  const from = env['MAIL_FROM'];
  // Zonder geldig afzenderadres weigert elke provider de mail toch; beter
  // hier één duidelijke reden dan een API-fout per verzonden bericht.
  if (!from || !/.+@.+\..+/.test(from)) {
    return {
      configured: false,
      reason: 'MAIL_FROM is niet gezet of bevat geen e-mailadres',
    };
  }

  return { configured: true, config: { provider: 'resend', apiKey, from } };
}
