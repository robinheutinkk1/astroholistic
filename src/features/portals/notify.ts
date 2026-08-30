import 'server-only';
/*
 * De achtste service-role-taak (zie src/lib/supabase/admin.ts).
 *
 * De beoordelaar van een verzoek mag lang niet altijd het profiel van de
 * indiener lezen — een dispatcher zonder clients.view bijvoorbeeld. Het
 * e-mailadres voor de melding is daar geen inbreuk op: er komt geen gegeven
 * terug naar het scherm van de beoordelaar, er gaat alleen een bericht naar
 * de indiener zelf.
 */
// eslint-disable-next-line no-restricted-imports
import { createUnscopedAdminClient } from '@/lib/supabase/admin';
import { publicEnv } from '@/lib/env';
import { sendMail } from '@/lib/mail/send';
import { renderMailHtml, renderMailText, type MailCard } from '@/lib/mail/layout';

/**
 * De inhoud van de beoordelingsmail, los van het versturen zodat hij een test
 * heeft.
 *
 * WAT ER BEWUST NIET IN STAAT: de naam van de cliënt, de rit, en de
 * toelichting van de planner. Een mail reist over servers van derden en ligt
 * in inboxen die gedeeld worden; de details staan achter de inlog van het
 * portaal, waar ze horen. De mail is alleen het duwtje daarheen.
 */
export function composeReviewedMail(decision: 'APPROVED' | 'REJECTED'): MailCard {
  const approved = decision === 'APPROVED';
  return {
    heading: approved ? 'Je verzoek is goedgekeurd' : 'Je verzoek is afgewezen',
    paragraphs: [
      approved
        ? 'De planning heeft je verzoek goedgekeurd.'
        : 'De planning heeft je verzoek afgewezen.',
      'De details en een eventuele toelichting staan in het portaal.',
    ],
    cta: { label: 'Open het portaal', url: `${publicEnv.NEXT_PUBLIC_APP_URL}/portaal` },
    footer:
      'Je ontvangt dit bericht omdat je via het portaal een verzoek hebt ingediend. Antwoorden op deze mail kan niet.',
  };
}

/**
 * Meldt de indiener dat er een besluit ligt.
 *
 * MAG NOOIT DE BEOORDELING LATEN MISLUKKEN. Een beoordeeld verzoek is
 * beoordeeld, ook als deze mail niet weg kan; elke overslag staat met reden
 * in het logboek van de hosting (zie lib/mail/send.ts).
 */
export async function notifyRequesterReviewed(
  requesterUserId: string,
  decision: 'APPROVED' | 'REJECTED',
): Promise<void> {
  try {
    const admin = createUnscopedAdminClient(
      'beoordelingsmail: adres van de indiener opzoeken, buiten de leesrechten van de beoordelaar om',
    );
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', requesterUserId)
      .maybeSingle();

    if (!profile?.email) {
      console.warn('Beoordelingsmail overgeslagen: indiener heeft geen adres', {
        requesterUserId,
      });
      return;
    }

    const card = composeReviewedMail(decision);
    await sendMail({
      to: profile.email,
      subject: card.heading,
      text: renderMailText(card),
      html: renderMailHtml(card),
    });
  } catch (error) {
    console.error('Beoordelingsmail niet verstuurd', {
      message: error instanceof Error ? error.message : 'onbekend',
    });
  }
}
