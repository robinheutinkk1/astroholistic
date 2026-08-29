import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileNav } from './mobile-nav';
import { type NavItem } from './sidebar';

/**
 * Zonder deze lade kan een planner op een telefoon nergens heen.
 *
 * Dat is precies zo'n fout die niemand op een laptop ziet: op desktop staat de
 * zijbalk er gewoon, en de lade is `md:hidden`. De test controleert wat een
 * duim doet — openen, een bestemming zien, en dat de lade weer dichtgaat.
 */

const pathname = '/dashboard';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    permission: 'organization.view',
  },
  { href: '/clienten', label: 'Cliënten', icon: 'clients', permission: 'clients.view' },
  {
    href: '/opdrachtgevers',
    label: 'Opdrachtgevers',
    icon: 'care',
    permission: 'care_organizations.view',
  },
];

describe('mobiele navigatie', () => {
  it('opent en toont alle bestemmingen', async () => {
    const user = userEvent.setup();
    render(<MobileNav items={ITEMS} title="Taxi Ontzorgd" />);

    // Dicht: geen navigatie zichtbaar.
    expect(screen.queryByRole('link', { name: 'Cliënten' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Menu openen' }));

    for (const item of ITEMS) {
      expect(await screen.findByRole('link', { name: item.label })).toHaveAttribute(
        'href',
        item.href,
      );
    }
  });

  it('gaat weer dicht met de sluitknop', async () => {
    const user = userEvent.setup();
    render(<MobileNav items={ITEMS} title="Taxi Ontzorgd" />);

    await user.click(screen.getByRole('button', { name: 'Menu openen' }));
    await user.click(await screen.findByRole('button', { name: 'Menu sluiten' }));

    expect(screen.queryByRole('link', { name: 'Cliënten' })).not.toBeInTheDocument();
  });

  it('de knoppen zijn groot genoeg voor een duim', async () => {
    // 44px, oftewel size-11. Een menuknop van 32px is op een telefoon een
    // gokspelletje.
    const user = userEvent.setup();
    render(<MobileNav items={ITEMS} title="Taxi Ontzorgd" />);

    const open = screen.getByRole('button', { name: 'Menu openen' });
    expect(open.className).toContain('size-11');

    await user.click(open);
    const close = await screen.findByRole('button', { name: 'Menu sluiten' });
    expect(close.className).toContain('size-11');
  });
});
