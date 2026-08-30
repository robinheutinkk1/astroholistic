import 'server-only';
import { resolveMailConfig } from './config';

/**
 * Het mailkanaal van de applicatie zelf.
 *
 * TWEE REGELS DIE ALLES BEPALEN:
 *
 * 1. Versturen mag nooit de handeling laten mislukken waar het bij hoort. Een
 *    beoordeeld verzoek is beoordeeld, ook als de mail erover niet weg kan;
 *    anders houdt een mailstoring de hele planning op.
 * 2. Niet kunnen versturen is nooit stil. Elke overslag komt met reden in het
 *    logboek van de hosting, want "de ouders krijgen geen mail" wil je daar
 *    vinden en niet uit een klacht.
 *
 * De provider is Resend via een kale fetch: geen dependency, en de naad
 * (resolveMailConfig + dit ene aanroeppunt) is klein genoeg om er later SMTP
 * of een andere dienst achter te hangen.
 */

export interface OutgoingMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

export type SendOutcome =
  { readonly sent: true } | { readonly sent: false; readonly reason: string };

export async function sendMail(mail: OutgoingMail): Promise<SendOutcome> {
  const resolved = resolveMailConfig();
  if (!resolved.configured) {
    console.warn('Mail niet verstuurd: kanaal niet ingesteld', {
      reason: resolved.reason,
      subject: mail.subject,
    });
    return { sent: false, reason: resolved.reason };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${resolved.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: resolved.config.from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
      }),
    });

    if (!response.ok) {
      // De statuscode wel, de body niet: die kan het adres van de ontvanger
      // herhalen en hoort dan niet integraal in een logboek.
      console.error('Mail geweigerd door de provider', {
        status: response.status,
        subject: mail.subject,
      });
      return { sent: false, reason: `provider antwoordde ${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.error('Mail niet verstuurd: verbinding met de provider mislukt', {
      subject: mail.subject,
      message: error instanceof Error ? error.message : 'onbekend',
    });
    return { sent: false, reason: 'verbinding met de provider mislukt' };
  }
}
