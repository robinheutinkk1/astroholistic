/**
 * De vaste vorm van een mail die het product zelf verstuurt.
 *
 * Dezelfde visuele taal als de auth-sjablonen in supabase/emails/ (kaart op
 * een lichte ondergrond, beeldmerk plus woordmerk), maar gerenderd door de
 * applicatie. Tabellen en stijlen op het element: mailprogramma's zijn geen
 * browsers.
 *
 * Zonder `server-only`, zodat de inhoud van elke mail testbaar is.
 */

export interface MailCard {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly cta?: { readonly label: string; readonly url: string };
  /** De verklarende regel onderaan: waarom de ontvanger dit krijgt. */
  readonly footer: string;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderMailText(card: MailCard): string {
  return [
    card.heading,
    '',
    ...card.paragraphs,
    ...(card.cta ? ['', `${card.cta.label}: ${card.cta.url}`] : []),
    '',
    card.footer,
  ].join('\n');
}

export function renderMailHtml(card: MailCard): string {
  const paragraphs = card.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 12px 0;font-family:${FONT};font-size:16px;line-height:26px;color:#334155;">${escapeHtml(text)}</p>`,
    )
    .join('');

  const cta = card.cta
    ? `<p style="margin:16px 0 0 0;"><a href="${escapeHtml(card.cta.url)}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;text-decoration:none;padding:14px 28px;border-radius:8px;">${escapeHtml(card.cta.label)}</a></p>`
    : '';

  return `<!doctype html>
<html lang="nl">
<head><meta charset="utf-8" /><meta name="color-scheme" content="light" /></head>
<body style="margin:0;padding:0;width:100%;background-color:#f1f5f9;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;">
<tr><td style="padding:0 0 20px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:0 10px 0 0;vertical-align:middle;"><img src="https://taxi.tagpoint.nl/email-mark.png" alt="" width="26" height="32" style="display:block;width:26px;height:32px;border:0;" /></td>
<td style="vertical-align:middle;"><span style="font-family:${FONT};font-size:22px;font-weight:600;letter-spacing:-0.02em;color:#0f172a;">Tagpoint</span></td>
</tr></table>
</td></tr>
<tr><td style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:36px 32px;">
<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:22px;line-height:30px;font-weight:600;letter-spacing:-0.02em;color:#0f172a;">${escapeHtml(card.heading)}</h1>
${paragraphs}${cta}
</td></tr>
<tr><td style="padding:20px 4px 0 4px;">
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:19px;color:#94a3b8;">${escapeHtml(card.footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
