import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type FormState } from '@/lib/errors/form-state';
import { ClientFundersCard } from './client-funders-card';
import type { ClientFunderRow } from '../service';

/**
 * De looptijd is hier het hele punt: een gemeente die de indicatie in juni
 * beëindigt, hoort de ritten van juli niet meer te zien. Het scherm moet dus
 * eerlijk laten zien welke periode nog loopt en welke voorbij is.
 */

const link = vi.fn<(formData: FormData) => Promise<FormState>>();
const unlink = vi.fn<(formData: FormData) => Promise<FormState>>();

vi.mock('../actions', () => ({
  linkClientAction: (_p: unknown, formData: FormData) => link(formData),
  unlinkClientAction: (_p: unknown, formData: FormData) => unlink(formData),
}));

beforeEach(() => {
  link.mockReset().mockResolvedValue({ status: 'idle' });
  unlink.mockReset().mockResolvedValue({ status: 'idle' });
});

const CLIENT = '30000000-0000-4000-8000-00000000000a';
const TODAY = '2026-08-29';

const LOPEND: ClientFunderRow = {
  careOrganizationId: '20000000-0000-4000-8000-00000000000a',
  name: 'Gemeente Enschede',
  validFrom: '2026-01-01',
  validTo: null,
};

const AFGELOPEN: ClientFunderRow = {
  careOrganizationId: '20000000-0000-4000-8000-00000000000b',
  name: 'Zorggroep De Brug',
  validFrom: '2025-01-01',
  validTo: '2025-12-31',
};

describe('opdrachtgever bij een cliënt', () => {
  it('scheidt een lopende periode van een afgelopen periode', () => {
    render(
      <ClientFundersCard
        clientId={CLIENT}
        links={[LOPEND, AFGELOPEN]}
        selectable={[]}
        canManage
        today={TODAY}
      />,
    );

    expect(screen.getByText('Loopt')).toBeInTheDocument();
    expect(screen.getByText('Afgelopen')).toBeInTheDocument();
    expect(screen.getByText(/geen einddatum/)).toBeInTheDocument();
    expect(screen.getByText(/tot en met 2025-12-31/)).toBeInTheDocument();
  });

  it('een periode die vandaag afloopt telt nog als lopend', () => {
    // De grens is inclusief. Een indicatie die "tot en met vandaag" loopt, loopt
    // vandaag nog — anders valt iemand een dag te vroeg buiten de boot.
    render(
      <ClientFundersCard
        clientId={CLIENT}
        links={[{ ...LOPEND, validTo: TODAY }]}
        selectable={[]}
        canManage
        today={TODAY}
      />,
    );

    expect(screen.getByText('Loopt')).toBeInTheDocument();
  });

  it('een periode die morgen begint loopt nog niet', () => {
    render(
      <ClientFundersCard
        clientId={CLIENT}
        links={[{ ...LOPEND, validFrom: '2026-08-30', validTo: null }]}
        selectable={[]}
        canManage
        today={TODAY}
      />,
    );

    expect(screen.getByText('Afgelopen')).toBeInTheDocument();
  });

  it('koppelt met de gekozen periode', async () => {
    const user = userEvent.setup();
    render(
      <ClientFundersCard
        clientId={CLIENT}
        links={[]}
        selectable={[{ id: LOPEND.careOrganizationId, name: 'Gemeente Enschede' }]}
        canManage
        today={TODAY}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Koppelen' }));

    const formData = link.mock.calls[0]![0];
    expect(formData.get('careOrganizationId')).toBe(LOPEND.careOrganizationId);
    expect(formData.get('validFrom')).toBe(TODAY);
    expect(formData.get('validTo')).toBe('');
  });

  it('verwijderen stuurt ook de begindatum mee', async () => {
    /*
     * Zonder `validFrom` zou het verwijderen álle periodes van deze
     * opdrachtgever raken, ook de historische. Die begindatum is deel van de
     * sleutel.
     */
    const user = userEvent.setup();
    render(
      <ClientFundersCard
        clientId={CLIENT}
        links={[AFGELOPEN]}
        selectable={[]}
        canManage
        today={TODAY}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Verwijderen' }));

    const formData = unlink.mock.calls[0]![0];
    expect(formData.get('careOrganizationId')).toBe(AFGELOPEN.careOrganizationId);
    expect(formData.get('validFrom')).toBe(AFGELOPEN.validFrom);
  });
});
