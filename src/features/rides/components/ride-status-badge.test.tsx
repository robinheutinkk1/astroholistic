import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RIDE_STATUSES, RIDE_STATUS_LABELS } from '../status';
import { RideStatusBadge } from './ride-status-badge';

describe('RideStatusBadge', () => {
  it.each(RIDE_STATUSES)('renders a readable Dutch label for %s', (status) => {
    render(<RideStatusBadge status={status} />);
    expect(screen.getByText(RIDE_STATUS_LABELS[status])).toBeInTheDocument();
  });

  it('never conveys status through colour alone', () => {
    // §48: a colour-blind dispatcher must be able to read the board.
    const { container } = render(<RideStatusBadge status="PROBLEM" />);
    expect(container.textContent?.trim()).toBe('Probleem');
  });
});
