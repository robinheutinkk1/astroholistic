import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganizationSwitcher } from './organization-switcher';

/**
 * Dezelfde soort test als bij het accountmenu, om dezelfde reden: dit menu
 * deed ooit niets bij een klik en niets merkte het op.
 */

const switchOrganization = vi.fn<(id: string) => Promise<void>>();

vi.mock('../actions', () => ({
  switchOrganizationAction: (id: string) => switchOrganization(id),
}));

const OPTIONS = [
  { id: '0a000000-0000-4000-8000-000000000000', name: 'Taxi Ontzorgd' },
  { id: '0b000000-0000-4000-8000-000000000000', name: 'Voorbeeld Taxi' },
];

beforeEach(() => {
  switchOrganization.mockReset();
  switchOrganization.mockResolvedValue(undefined);
});

describe('organisatiewisselaar', () => {
  it('wisselt naar de gekozen organisatie', async () => {
    const user = userEvent.setup();
    render(<OrganizationSwitcher options={OPTIONS} activeId={OPTIONS[0]!.id} />);

    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByRole('menuitem', { name: /voorbeeld taxi/i }));

    expect(switchOrganization).toHaveBeenCalledWith(OPTIONS[1]!.id);
  });

  it('toont geen keuzemenu bij één organisatie', () => {
    // Een "wisselaar" met één regel is ruis op het scherm.
    render(<OrganizationSwitcher options={[OPTIONS[0]!]} activeId={OPTIONS[0]!.id} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Taxi Ontzorgd')).toBeInTheDocument();
  });

  it('elk item is een bedienbaar menu-item en geen formulier', async () => {
    const user = userEvent.setup();
    render(<OrganizationSwitcher options={OPTIONS} activeId={OPTIONS[0]!.id} />);

    await user.click(screen.getByRole('button'));
    for (const item of await screen.findAllByRole('menuitem')) {
      expect(item.tagName).not.toBe('FORM');
      expect(item.querySelector('form')).toBeNull();
    }
  });
});
