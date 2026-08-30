import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorPage from './error';
import NotFound from './not-found';

/**
 * De vangnetten onder elke route. Tot dit bestand bestond waren er nul: een
 * serverfout toonde de kale frameworkpagina, en dat viel geen enkele test op
 * omdat er niets was om op om te vallen.
 */

function boom(digest?: string): Error & { digest?: string } {
  const error = new Error('interne details die de gebruiker niet mag zien');
  if (digest) (error as Error & { digest?: string }).digest = digest;
  return error;
}

describe('de foutpagina', () => {
  it('biedt opnieuw proberen aan en roept reset echt aan', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<ErrorPage error={boom()} reset={reset} />);

    await user.click(screen.getByRole('button', { name: 'Opnieuw proberen' }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('toont de digest zodat de beheerder de fout kan terugvinden', () => {
    render(<ErrorPage error={boom('abc123')} reset={vi.fn()} />);

    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('toont nooit de tekst van de fout zelf', () => {
    // Die kan interne paden of queryfragmenten bevatten. De digest volstaat.
    render(<ErrorPage error={boom('abc123')} reset={vi.fn()} />);

    expect(screen.queryByText(/interne details/)).not.toBeInTheDocument();
  });

  it('biedt een uitweg naar het beginscherm, als harde navigatie', async () => {
    // Geen router-link: na een fout is een verse paginalading betrouwbaarder
    // dan navigeren binnen de kapotte componentenboom.
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    render(<ErrorPage error={boom()} reset={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Naar het beginscherm' }));

    expect(assign).toHaveBeenCalledWith('/');
    vi.unstubAllGlobals();
  });
});

describe('de 404-pagina', () => {
  it('legt uit zonder te verraden of iets elders bestaat', () => {
    render(<NotFound />);

    expect(screen.getByText(/hoort niet bij jouw organisatie/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Naar het beginscherm' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
