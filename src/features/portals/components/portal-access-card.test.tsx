import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type FormState } from '@/lib/errors/form-state';
import { PortalAccessCard } from './portal-access-card';

/**
 * De gevaarlijkste knop in het product: hij koppelt een inlogaccount aan het
 * dossier van een mens. De test bewaakt drie dingen die je op het scherm niet
 * ziet als ze fout gaan — dat de soort en de id echt worden meegestuurd, dat
 * je nooit per ongeluk over een bestaande koppeling heen kunt schrijven, en
 * dat iemand zonder rechten geen formulier krijgt.
 */

const grant = vi.fn<(formData: FormData) => Promise<FormState>>();
const revoke = vi.fn<(formData: FormData) => Promise<FormState>>();

vi.mock('../actions', () => ({
  grantPortalAccessAction: (_p: unknown, formData: FormData) => grant(formData),
  revokePortalAccessAction: (_p: unknown, formData: FormData) => revoke(formData),
}));

beforeEach(() => {
  grant.mockReset().mockResolvedValue({ status: 'idle' });
  revoke.mockReset().mockResolvedValue({ status: 'idle' });
});

const SUBJECT = '30000000-0000-4000-8000-00000000000a';

describe('portaaltoegang', () => {
  it('stuurt soort, id en e-mailadres mee', async () => {
    const user = userEvent.setup();
    render(
      <PortalAccessCard
        kind="CLIENT"
        subjectId={SUBJECT}
        currentEmail={null}
        canManage
      />,
    );

    await user.type(screen.getByLabelText(/e-mailadres/i), 'jan@voorbeeld.nl');
    await user.click(screen.getByRole('button', { name: /toegang geven/i }));

    const formData = grant.mock.calls[0]![0];
    expect(formData.get('kind')).toBe('CLIENT');
    expect(formData.get('subjectId')).toBe(SUBJECT);
    expect(formData.get('email')).toBe('jan@voorbeeld.nl');
  });

  it('toont geen invulveld als er al toegang is', () => {
    /*
     * Anders zou een planner er ongemerkt een tweede adres overheen zetten en
     * denken dat de eerste persoon nog meekijkt. Eerst intrekken, dan opnieuw.
     */
    render(
      <PortalAccessCard
        kind="CONTACT"
        subjectId={SUBJECT}
        currentEmail="olga@voorbeeld.nl"
        canManage
      />,
    );

    expect(screen.queryByLabelText(/e-mailadres/i)).not.toBeInTheDocument();
    expect(screen.getByText('olga@voorbeeld.nl')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /intrekken/i })).toBeInTheDocument();
  });

  it('trekt in met dezelfde soort en id', async () => {
    const user = userEvent.setup();
    render(
      <PortalAccessCard
        kind="CONTACT"
        subjectId={SUBJECT}
        currentEmail="olga@voorbeeld.nl"
        canManage
      />,
    );

    await user.click(screen.getByRole('button', { name: /intrekken/i }));

    const formData = revoke.mock.calls[0]![0];
    expect(formData.get('kind')).toBe('CONTACT');
    expect(formData.get('subjectId')).toBe(SUBJECT);
  });

  it('geeft zonder rechten geen enkele knop', () => {
    render(
      <PortalAccessCard
        kind="CLIENT"
        subjectId={SUBJECT}
        currentEmail={null}
        canManage={false}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/e-mailadres/i)).not.toBeInTheDocument();
  });

  it('laat een lezer wel zien dát er toegang is, maar niet de knop', () => {
    render(
      <PortalAccessCard
        kind="CLIENT"
        subjectId={SUBJECT}
        currentEmail="jan@voorbeeld.nl"
        canManage={false}
      />,
    );

    expect(screen.getByText('jan@voorbeeld.nl')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /intrekken/i })).not.toBeInTheDocument();
  });
});
