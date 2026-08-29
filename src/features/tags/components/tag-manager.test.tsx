import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TagManager } from './tag-manager';
import { encodeQr } from '../qr';
import type * as React from 'react';

/**
 * Wat er gebeurt op het enige moment dat de code van een tag zichtbaar is.
 *
 * De QR-code stond eerder achter een link naar `/tags/{id}/qr`. Die pagina
 * bestond niet, en had ook niet kunnen bestaan: van een tag bewaren we alleen
 * een versleutelde afdruk, dus de server kan die link nooit opnieuw opbouwen.
 * De code wordt daarom hier in de browser getekend.
 *
 * De belangrijkste assertie hieronder is dat de QR de échte tag-link bevat.
 * Een plaatje dat er goed uitziet maar iets anders codeert, ontdek je pas als
 * een chauffeur voor de deur staat.
 */

vi.mock('../actions', () => ({
  createTagAction: vi.fn(),
  assignTagAction: vi.fn(),
  setTagStatusAction: vi.fn(),
  unassignTagAction: vi.fn(),
}));

const APP_URL = 'https://taxi.tagpoint.nl';
const TOKEN = 'ABCDEFGHJKMNPQRSTVWXYZ23456789AB';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');
  return {
    ...actual,
    // De aangemaakte tag komt normaal uit de server action. Die vervangen we
    // hier door een vaste uitkomst, zodat het paneel te zien is.
    useActionState: (_action: unknown, initial: unknown) => {
      const withTag = {
        status: 'success',
        message: 'Tag aangemaakt.',
        created: { id: 'tag-1', publicCode: 'TP-0001', token: TOKEN },
      };
      return [
        (initial as { created?: unknown })?.created === undefined ? withTag : initial,
        vi.fn(),
        false,
      ];
    },
  };
});

describe('nieuwe tag', () => {
  it('toont de QR-code en het downloadbestand', () => {
    render(<TagManager tags={[]} clients={[]} canManage appUrl={APP_URL} />);

    const image = screen.getByAltText('QR-code voor tag TP-0001');
    expect(image).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));

    const download = screen.getByRole('link', { name: /downloaden om te printen/i });
    expect(download).toHaveAttribute('download', 'tag-TP-0001.svg');
  });

  it('de QR bevat exact dezelfde link als de NFC-tag', () => {
    /*
     * Dit is de assertie die ertoe doet. De afbeelding wordt gedecodeerd tot de
     * matrix die hoort bij de verwachte URL, en die moet gelijk zijn aan wat er
     * op het scherm staat. Zonder deze vergelijking zou elk plaatje slagen.
     */
    render(<TagManager tags={[]} clients={[]} canManage appUrl={APP_URL} />);

    const src = screen.getByAltText('QR-code voor tag TP-0001').getAttribute('src')!;
    const svg = atob(src.replace('data:image/svg+xml;base64,', ''));

    const expected = encodeQr(`${APP_URL}/t/${TOKEN}`);
    const wrong = encodeQr(`${APP_URL}/t/IETSANDERS`);

    // De SVG bevat de modules van de juiste tekst; een andere tekst geeft een
    // ander patroon, dus deze twee mogen nooit allebei passen.
    const pathOf = (matrix: boolean[][]) => {
      let path = '';
      for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < matrix.length; col += 1) {
          if (matrix[row]![col]) path += `M${col + 2} ${row + 2}h1v1h-1z`;
        }
      }
      return path;
    };

    expect(svg).toContain(pathOf(expected));
    expect(svg).not.toContain(pathOf(wrong));
  });

  it('zegt dat de code hierna niet meer op te vragen is', () => {
    // De enige waarschuwing die telt: hierna is de tag weg als je hem kwijt bent.
    render(<TagManager tags={[]} clients={[]} canManage appUrl={APP_URL} />);

    expect(screen.getByText(/niet meer op te vragen/i)).toBeInTheDocument();
  });

  it('toont de volledige tag-link om naar de NFC-tag te schrijven', () => {
    render(<TagManager tags={[]} clients={[]} canManage appUrl={APP_URL} />);

    expect(screen.getByLabelText('Tag-link')).toHaveValue(`${APP_URL}/t/${TOKEN}`);
  });
});
