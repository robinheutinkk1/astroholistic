import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type FormState } from '@/lib/errors/form-state';
import { InviteMemberForm } from './invite-member-form';

const invite = vi.fn<(formData: FormData) => Promise<FormState>>();

vi.mock('../actions', () => ({
  inviteMemberAction: (_p: unknown, formData: FormData) => invite(formData),
}));

beforeEach(() => {
  invite.mockReset().mockResolvedValue({ status: 'idle' });
});

const ROLES = [
  {
    id: '10000000-0000-4000-8000-00000000000a',
    key: 'planner',
    name: 'Planner',
    description: null,
  },
  {
    id: '10000000-0000-4000-8000-00000000000b',
    key: 'driver',
    name: 'Chauffeur',
    description: null,
  },
];

describe('gebruiker uitnodigen', () => {
  it('stuurt het adres en elke aangevinkte rol mee', async () => {
    const user = userEvent.setup();
    render(<InviteMemberForm roles={ROLES} />);

    await user.type(screen.getByLabelText(/e-mailadres/i), 'nieuw@vervoerder.nl');
    await user.click(screen.getByRole('checkbox', { name: /chauffeur/i }));
    await user.click(screen.getByRole('button', { name: /uitnodiging versturen/i }));

    const formData = invite.mock.calls[0]![0];
    expect(formData.get('email')).toBe('nieuw@vervoerder.nl');
    expect(formData.getAll('roleIds')).toEqual([ROLES[1]!.id]);
  });

  it('verstuurt meerdere rollen als er meerdere zijn aangevinkt', async () => {
    const user = userEvent.setup();
    render(<InviteMemberForm roles={ROLES} />);

    await user.type(screen.getByLabelText(/e-mailadres/i), 'nieuw@vervoerder.nl');
    await user.click(screen.getByRole('checkbox', { name: /planner/i }));
    await user.click(screen.getByRole('checkbox', { name: /chauffeur/i }));
    await user.click(screen.getByRole('button', { name: /uitnodiging versturen/i }));

    expect(invite.mock.calls[0]![0].getAll('roleIds')).toHaveLength(2);
  });

  it('legt uit waarom er niets te kiezen valt in plaats van een leeg formulier', () => {
    /*
     * Wie zelf geen rollen mag toekennen, kan niemand uitnodigen. Een leeg
     * formulier met een knop die altijd faalt zou dat niet uitleggen.
     */
    render(<InviteMemberForm roles={[]} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/geen rol mag toekennen/i)).toBeInTheDocument();
  });
});
