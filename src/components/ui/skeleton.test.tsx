import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageSkeleton } from './skeleton';
import OrgLoading from '@/app/(org)/loading';
import DriverLoading from '@/app/driver/loading';
import PortalLoading from '@/app/portaal/loading';

/**
 * Laadstatussen zijn onzichtbaar in elke andere test: ze bestaan alleen
 * tijdens het wachten. Dit legt vast dat elke shell er een heeft en dat een
 * schermlezer hoort wat er gebeurt in plaats van stilte.
 */
describe('laadskeletten', () => {
  it('elke shell heeft een laadstatus die zich meldt bij een schermlezer', () => {
    for (const LoadingShell of [OrgLoading, DriverLoading, PortalLoading]) {
      const { unmount } = render(<LoadingShell />);
      expect(screen.getByLabelText('Bezig met laden')).toBeInTheDocument();
      unmount();
    }
  });

  it('het skelet is decoratie, geen inhoud', () => {
    // aria-hidden op de blokken: een schermlezer krijgt één melding, niet
    // twaalf lege elementen.
    const { container } = render(<PageSkeleton />);
    const blocks = container.querySelectorAll('[aria-hidden="true"]');
    expect(blocks.length).toBeGreaterThan(3);
  });
});
