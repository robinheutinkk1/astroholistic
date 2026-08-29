import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from './user-menu';

/**
 * De knop moet echt iets doen.
 *
 * WAAROM DIT BESTAAT. Twee keer is er een menu-item de productie in gegaan dat
 * er goed uitzag en niets deed: de organisatiewisselaar en het uitloggen.
 * Allebei dezelfde oorzaak — een <form> binnen een Radix-menu-item, dat de klik
 * afvangt en het menu sluit voordat de browser het formulier kan versturen.
 *
 * Geen enkele unittest zag dat, want de logica erachter klopte gewoon. En de
 * E2E-test die het wél zou zien slaat over zolang er geen ingelogde sessie is.
 * Deze test klikt daadwerkelijk en controleert dat de server action wordt
 * aangeroepen. Dat is precies het gat waar allebei de fouten doorheen gleden.
 */

const signOut = vi.fn<() => Promise<void>>();

vi.mock('@/features/auth/actions', () => ({
  signOutAction: () => signOut(),
}));

beforeEach(() => {
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
});

function renderMenu() {
  return render(
    <UserMenu
      fullName="Sanne de Vries"
      email="sanne@vervoerder.nl"
      roleLabels={['Planner']}
    />,
  );
}

describe('accountmenu', () => {
  it('roept het uitloggen aan als erop wordt geklikt', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Accountmenu' }));
    await user.click(await screen.findByRole('menuitem', { name: /uitloggen/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('toont de naam en de rol van de ingelogde gebruiker', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Accountmenu' }));

    expect(await screen.findByText('Sanne de Vries')).toBeInTheDocument();
    expect(screen.getByText('sanne@vervoerder.nl')).toBeInTheDocument();
    expect(screen.getByText('Planner')).toBeInTheDocument();
  });

  it('het uitloggen is een menu-item en geen formulier zonder bedienbare inhoud', async () => {
    /*
     * De oude constructie gaf `role="menuitem"` aan het <form> in plaats van
     * aan de knop erin. Voor een schermlezer was dat een menu-item waar niets
     * in te bedienen viel. Deze assertie legt vast dat het item zelf de
     * bedienbare knop is.
     */
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Accountmenu' }));
    const item = await screen.findByRole('menuitem', { name: /uitloggen/i });

    expect(item.tagName).not.toBe('FORM');
    expect(item.querySelector('form')).toBeNull();
  });

  it('de link naar het profiel wijst naar /profiel', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Accountmenu' }));
    const link = await screen.findByRole('menuitem', { name: /mijn profiel/i });

    expect(link).toHaveAttribute('href', '/profiel');
  });
});
