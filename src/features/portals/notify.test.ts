import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ createUnscopedAdminClient: vi.fn() }));
vi.mock('@/lib/env', () => ({
  publicEnv: { NEXT_PUBLIC_APP_URL: 'https://taxi.tagpoint.nl' },
}));
vi.mock('@/lib/mail/send', () => ({ sendMail: vi.fn() }));

const { composeReviewedMail } = await import('./notify');
const { renderMailHtml, renderMailText } = await import('@/lib/mail/layout');

/**
 * De beoordelingsmail is het eerste bericht dat het product zélf verstuurt.
 * De belangrijkste eigenschap is wat er NIET in staat.
 */
describe('de beoordelingsmail', () => {
  it('vertelt het besluit en wijst naar het portaal', () => {
    const approved = composeReviewedMail('APPROVED');
    expect(approved.heading).toBe('Je verzoek is goedgekeurd');
    expect(approved.cta?.url).toBe('https://taxi.tagpoint.nl/portaal');

    const rejected = composeReviewedMail('REJECTED');
    expect(rejected.heading).toBe('Je verzoek is afgewezen');
  });

  it('bevat geen enkel persoonsgegeven', () => {
    // Een mail reist over servers van derden en ligt in gedeelde inboxen.
    // Namen, ritten en de toelichting van de planner horen achter de inlog.
    const card = composeReviewedMail('APPROVED');
    const everything = [card.heading, ...card.paragraphs, card.footer].join(' ');
    expect(everything).not.toMatch(/cliënt\s+[A-Z]/);
    expect(card.paragraphs.join(' ')).toContain('in het portaal');
  });

  it('de tekstversie en de HTML dragen dezelfde inhoud', () => {
    const card = composeReviewedMail('REJECTED');
    const text = renderMailText(card);
    const html = renderMailHtml(card);
    for (const paragraph of card.paragraphs) {
      expect(text).toContain(paragraph);
      expect(html).toContain(paragraph);
    }
    expect(html).toContain('https://taxi.tagpoint.nl/portaal');
  });

  it('HTML in invoer wordt onschadelijk gemaakt', () => {
    const html = renderMailHtml({
      heading: '<script>alert(1)</script>',
      paragraphs: ['a & b'],
      footer: 'f',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b');
  });
});
