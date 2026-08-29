import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type FormState } from '@/lib/errors/form-state';
import { ClientContactsCard } from './client-contacts-card';
import type { ContactLinkRow } from '../service';

/**
 * De drie vinkjes bepalen wat een ouder over een kind te zien krijgt. Ze zijn
 * daarmee het gevoeligste formulier in het cliëntscherm.
 *
 * Het addertje: een checkbox die niet is aangevinkt komt helemaal niet in de
 * FormData voor. Wie dat afleest als "veld ontbreekt, dus laat maar staan",
 * bouwt een scherm waarin een vinkje wel aan maar nooit meer uit kan. Deze test
 * legt vast dat uitvinken ook echt uitzetten betekent.
 */

const link = vi.fn<(formData: FormData) => Promise<FormState>>();
const unlink = vi.fn<(formData: FormData) => Promise<FormState>>();

vi.mock('../actions', () => ({
  linkContactAction: (_p: unknown, formData: FormData) => link(formData),
  unlinkContactAction: (_p: unknown, formData: FormData) => unlink(formData),
}));

beforeEach(() => {
  link.mockReset().mockResolvedValue({ status: 'idle' });
  unlink.mockReset().mockResolvedValue({ status: 'idle' });
});

const CLIENT = '30000000-0000-4000-8000-00000000000a';

const OLGA: ContactLinkRow = {
  contactId: '40000000-0000-4000-8000-00000000000a',
  firstName: 'Olga',
  lastName: 'Jansen',
  phone: '0612345678',
  email: 'olga@voorbeeld.nl',
  userId: null,
  relationship: 'moeder',
  isPrimary: true,
  canViewRides: true,
  canReportAbsence: true,
  canRequestChanges: false,
};

describe('contactpersonen bij een cliënt', () => {
  it('toont per koppeling wat die persoon mag', () => {
    render(
      <ClientContactsCard clientId={CLIENT} links={[OLGA]} selectable={[]} canManage />,
    );

    expect(screen.getByText('Olga Jansen')).toBeInTheDocument();
    expect(screen.getByText(/moeder/)).toBeInTheDocument();
    expect(screen.getByText('Ziet ritten')).toBeInTheDocument();
    expect(screen.getByText('Meldt afwezig')).toBeInTheDocument();
    expect(screen.queryByText('Vraagt wijzigingen aan')).not.toBeInTheDocument();
  });

  it('zegt het expliciet als iemand niets mag zien', () => {
    // Een lege regel zou hier "ik weet het niet" betekenen. Dat is te vaag voor
    // een scherm dat over inzage in andermans gegevens gaat.
    render(
      <ClientContactsCard
        clientId={CLIENT}
        links={[
          {
            ...OLGA,
            canViewRides: false,
            canReportAbsence: false,
            canRequestChanges: false,
          },
        ]}
        selectable={[]}
        canManage
      />,
    );

    expect(screen.getByText('Ziet niets in het portaal')).toBeInTheDocument();
  });

  it('een vinkje uitzetten stuurt ook echt "uit" mee', async () => {
    const user = userEvent.setup();
    render(
      <ClientContactsCard clientId={CLIENT} links={[OLGA]} selectable={[]} canManage />,
    );

    await user.click(screen.getByRole('button', { name: /afspraken wijzigen/i }));
    await user.click(
      await screen.findByRole('checkbox', { name: /mag afwezigheid melden/i }),
    );
    await user.click(screen.getByRole('button', { name: /afspraken opslaan/i }));

    const formData = link.mock.calls[0]![0];
    expect(formData.get('clientId')).toBe(CLIENT);
    expect(formData.get('contactId')).toBe(OLGA.contactId);
    // Aangevinkt gebleven:
    expect(formData.get('canViewRides')).not.toBeNull();
    // Zojuist uitgezet, en dus afwezig in de FormData:
    expect(formData.get('canReportAbsence')).toBeNull();
  });

  it('koppelt een nieuwe contactpersoon uit de keuzelijst', async () => {
    const user = userEvent.setup();
    render(
      <ClientContactsCard
        clientId={CLIENT}
        links={[]}
        selectable={[{ id: OLGA.contactId, name: 'Olga Jansen' }]}
        canManage
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Koppelen' }));

    const formData = link.mock.calls[0]![0];
    expect(formData.get('contactId')).toBe(OLGA.contactId);
    expect(formData.get('clientId')).toBe(CLIENT);
  });

  it('loskoppelen stuurt beide ids mee', async () => {
    const user = userEvent.setup();
    render(
      <ClientContactsCard clientId={CLIENT} links={[OLGA]} selectable={[]} canManage />,
    );

    await user.click(screen.getByRole('button', { name: 'Loskoppelen' }));

    const formData = unlink.mock.calls[0]![0];
    expect(formData.get('clientId')).toBe(CLIENT);
    expect(formData.get('contactId')).toBe(OLGA.contactId);
  });

  it('zonder rechten geen enkele knop om iets te wijzigen', () => {
    render(
      <ClientContactsCard
        clientId={CLIENT}
        links={[OLGA]}
        selectable={[{ id: 'x', name: 'Iemand' }]}
        canManage={false}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /loskoppelen/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /koppelen/i })).not.toBeInTheDocument();
    // Maar de bestaande koppeling is wel gewoon te lezen.
    expect(screen.getByText('Olga Jansen')).toBeInTheDocument();
  });
});
