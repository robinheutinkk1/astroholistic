import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteDialog } from './delete-dialog';
import { IDLE, type FormState } from '@/lib/errors/form-state';

/**
 * De bevestiging voor iets onomkeerbaars.
 *
 * Twee dingen moeten kloppen en allebei zijn ze onzichtbaar tot ze misgaan: de
 * dialoog moet daadwerkelijk opengaan, en de bevestigknop moet de actie mét de
 * juiste id versturen. Een dialoog die de id kwijtraakt verwijdert niets, of
 * erger, iets anders.
 */

function renderDialog(action: (p: FormState, f: FormData) => Promise<FormState>) {
  return render(
    <DeleteDialog
      id="30000000-0000-4000-8000-00000000000a"
      title="Cliënt verwijderen?"
      description="De 42 bestaande ritten blijven in de administratie staan."
      action={action}
    />,
  );
}

describe('bevestiging bij verwijderen', () => {
  it('verwijdert pas na bevestigen, en stuurt de id mee', async () => {
    const user = userEvent.setup();
    const action = vi.fn((_previous: FormState, formData: FormData) => {
      expect(formData.get('id')).toBe('30000000-0000-4000-8000-00000000000a');
      return Promise.resolve(IDLE);
    });

    renderDialog(action);

    // Zolang de dialoog dicht is, is er niets verstuurd.
    expect(action).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Verwijderen' }));
    await user.click(
      await screen.findByRole('button', { name: 'Definitief verwijderen' }),
    );

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('noemt het gevolg en niet alleen "weet je het zeker"', async () => {
    const user = userEvent.setup();
    renderDialog(() => Promise.resolve(IDLE));

    await user.click(screen.getByRole('button', { name: 'Verwijderen' }));

    expect(await screen.findByText(/42 bestaande ritten/)).toBeInTheDocument();
  });

  it('annuleren verwijdert niets', async () => {
    const user = userEvent.setup();
    const action = vi.fn(() => Promise.resolve(IDLE));
    renderDialog(action);

    await user.click(screen.getByRole('button', { name: 'Verwijderen' }));
    await user.click(await screen.findByRole('button', { name: 'Annuleren' }));

    expect(action).not.toHaveBeenCalled();
  });
});
