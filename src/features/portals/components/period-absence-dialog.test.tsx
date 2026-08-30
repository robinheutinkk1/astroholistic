import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type FormState } from '@/lib/errors/form-state';
import { PeriodAbsenceDialog } from './period-absence-dialog';

/**
 * Wat je op het scherm niet ziet als het fout gaat: dat het verzoek als
 * ABSENCE zónder rit vertrekt, mét beide datums. Een verkeerde hidden field
 * zou stilletjes een gewoon wijzigingsverzoek van maken.
 */

const submit = vi.fn<(formData: FormData) => Promise<FormState>>();

vi.mock('../actions', () => ({
  submitRequestAction: (_p: unknown, formData: FormData) => submit(formData),
}));

beforeEach(() => {
  submit.mockReset().mockResolvedValue({ status: 'idle' });
});

const CLIENT = '30000000-0000-4000-8000-00000000000a';

describe('periode-afmelding', () => {
  it('verstuurt ABSENCE zonder rit, met beide datums en de toelichting', async () => {
    const user = userEvent.setup();
    render(<PeriodAbsenceDialog clientId={CLIENT} clientName="Jan Jansen" />);

    await user.click(screen.getByRole('button', { name: /langere tijd afmelden/i }));

    const from = '2099-09-02';
    const to = '2099-09-13';
    await user.type(screen.getByLabelText(/eerste dag/i), from);
    await user.type(screen.getByLabelText(/laatste dag/i), to);
    await user.type(screen.getByPlaceholderText(/toelichting/i), 'Vakantie');
    await user.click(screen.getByRole('button', { name: /afmelding versturen/i }));

    const formData = submit.mock.calls[0]![0];
    expect(formData.get('clientId')).toBe(CLIENT);
    expect(formData.get('kind')).toBe('ABSENCE');
    expect(formData.get('rideId')).toBe('');
    expect(formData.get('from')).toBe(from);
    expect(formData.get('to')).toBe(to);
    expect(formData.get('note')).toBe('Vakantie');
  });

  it('toont de foutmelding van de server in het formulier', async () => {
    submit.mockResolvedValue({
      status: 'error',
      message: 'Er staat al een periode-afmelding open.',
    });
    const user = userEvent.setup();
    render(<PeriodAbsenceDialog clientId={CLIENT} clientName="Jan Jansen" />);

    await user.click(screen.getByRole('button', { name: /langere tijd afmelden/i }));
    await user.type(screen.getByLabelText(/eerste dag/i), '2099-09-02');
    await user.type(screen.getByLabelText(/laatste dag/i), '2099-09-13');
    await user.click(screen.getByRole('button', { name: /afmelding versturen/i }));

    expect(
      await screen.findByText(/er staat al een periode-afmelding open/i),
    ).toBeInTheDocument();
  });
});
