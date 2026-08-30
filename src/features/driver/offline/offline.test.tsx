import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type FormState } from '@/lib/errors/form-state';
import { DriverOfflineProvider } from './context';
import { OfflineBanner } from './offline-banner';
import { enqueue, readQueue, storageKey } from './queue';
import { QUEUED_MESSAGE } from './use-driver-submit';
import { DriverActionButton } from '../components/action-button';

/**
 * De reis van een klik zonder bereik: knop → wachtrij → banner → server.
 *
 * Dit is de plek waar het echte dataverlies zat. Vóór deze wachtrij gooide
 * een mislukte verbinding de chauffeur op het foutscherm en was de check-in
 * weg; geen enkele test zag dat, want niets simuleerde ooit een kapotte
 * verbinding.
 */

const runQueuedKind = vi.fn<(kind: string, formData: FormData) => Promise<FormState>>();

vi.mock('./actions-map', () => ({
  runQueuedKind: (kind: string, formData: FormData) => runQueuedKind(kind, formData),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const USER = 'chauffeur-1';
const KEY = storageKey(USER);

function renderButton(captureGps = false) {
  return render(
    <DriverOfflineProvider userId={USER}>
      <DriverActionButton
        rideId="rit-1"
        action="checkin"
        label="Ingestapt"
        captureGps={captureGps}
      />
    </DriverOfflineProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  runQueuedKind.mockReset();
  refresh.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('de actieknop met verbinding', () => {
  it('verstuurt direct en zet niets in de wachtrij', async () => {
    const user = userEvent.setup();
    runQueuedKind.mockResolvedValue({ status: 'success' });
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Ingestapt' }));

    await waitFor(() => expect(runQueuedKind).toHaveBeenCalledTimes(1));
    const [kind, formData] = runQueuedKind.mock.calls[0]!;
    expect(kind).toBe('ride-action');
    expect(formData.get('rideId')).toBe('rit-1');
    expect(formData.get('action')).toBe('checkin');
    // Het moment van de klik gaat altijd mee, ook bij een directe poging.
    expect(formData.get('occurredAt')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(readQueue(localStorage, KEY)).toEqual([]);
  });

  it('toont een afwijzing van de server als tekst, niet als crash', async () => {
    const user = userEvent.setup();
    runQueuedKind.mockResolvedValue({
      status: 'error',
      message: 'Deze stap kan nu niet.',
    });
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Ingestapt' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Deze stap kan nu niet.');
    expect(readQueue(localStorage, KEY)).toEqual([]);
  });
});

describe('de actieknop zonder verbinding', () => {
  it('bewaart de registratie en zegt dat, in plaats van een foutscherm', async () => {
    const user = userEvent.setup();
    runQueuedKind.mockRejectedValue(new TypeError('Failed to fetch'));
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Ingestapt' }));

    expect(await screen.findByRole('status')).toHaveTextContent(QUEUED_MESSAGE);

    const queue = readQueue(localStorage, KEY);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.kind).toBe('ride-action');
    expect(queue[0]!.fields['rideId']).toBe('rit-1');
    // De wachtrijregel draagt het klikmoment, zodat de check-in straks op de
    // echte tijd de administratie in gaat.
    expect(queue[0]!.fields['occurredAt']).toBe(queue[0]!.occurredAt);
  });

  it('een echte fout wordt géén wachtrijregel', async () => {
    // Eeuwig herhalen maakt een kapotte aanvraag niet heel.
    const user = userEvent.setup();
    runQueuedKind.mockRejectedValue(new Error('kolom bestaat niet'));
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Ingestapt' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Er ging iets mis');
    expect(readQueue(localStorage, KEY)).toEqual([]);
  });
});

describe('de actieknop met GPS aan', () => {
  it('verstuurt precies één keer, met de positie erbij', async () => {
    /*
     * De oude constructie (preventDefault + requestSubmit) vuurde de
     * onSubmit opnieuw af, die opnieuw preventDefault deed: een lus waarin
     * de actie nooit vertrok zodra GPS aanstond. Deze test staat er zodat
     * die constructie niet terug kan sluipen.
     */
    const user = userEvent.setup();
    runQueuedKind.mockResolvedValue({ status: 'success' });
    vi.stubGlobal('navigator', {
      ...navigator,
      onLine: true,
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({
            coords: { latitude: 52.22, longitude: 6.89, accuracy: 12 },
          } as GeolocationPosition),
      },
    });
    renderButton(true);

    await user.click(screen.getByRole('button', { name: 'Ingestapt' }));

    await waitFor(() => expect(runQueuedKind).toHaveBeenCalledTimes(1));
    const [, formData] = runQueuedKind.mock.calls[0]!;
    expect(formData.get('latitude')).toBe('52.22');
    expect(formData.get('longitude')).toBe('6.89');
  });
});

describe('de banner die de wachtrij verstuurt', () => {
  function seed(label: string, fields: Record<string, string>) {
    return enqueue(localStorage, KEY, {
      kind: 'ride-action',
      fields,
      occurredAt: '2026-08-30T08:14:00.000Z',
      label,
    });
  }

  function renderBanner() {
    return render(
      <DriverOfflineProvider userId={USER}>
        <OfflineBanner />
      </DriverOfflineProvider>,
    );
  }

  it('verstuurt de rij in klikvolgorde en ruimt op na succes', async () => {
    seed('eerste', { rideId: 'rit-1', action: 'checkin', occurredAt: 'A' });
    seed('tweede', { rideId: 'rit-1', action: 'trip', occurredAt: 'B' });
    runQueuedKind.mockResolvedValue({ status: 'success' });

    renderBanner();

    await waitFor(() => expect(runQueuedKind).toHaveBeenCalledTimes(2));
    // Instappen vóór rijden: de volgorde ís de statusmachine.
    expect(runQueuedKind.mock.calls[0]![1].get('action')).toBe('checkin');
    expect(runQueuedKind.mock.calls[1]![1].get('action')).toBe('trip');
    // Het oorspronkelijke klikmoment reist mee, niet het verzendmoment.
    expect(runQueuedKind.mock.calls[0]![1].get('occurredAt')).toBe('A');

    await waitFor(() => expect(readQueue(localStorage, KEY)).toEqual([]));
    expect(refresh).toHaveBeenCalled();
  });

  it('een afwijzing haalt de regel uit de rij en meldt dat wegklikbaar', async () => {
    // De wereld is intussen veranderd; eeuwig herhalen maakt dat niet anders,
    // maar stilzwijgend laten verdwijnen is erger.
    const user = userEvent.setup();
    seed('Check-in van 08:14', { rideId: 'rit-1', action: 'checkin' });
    runQueuedKind.mockResolvedValue({
      status: 'error',
      message: 'Deze stap kan nu niet.',
    });

    renderBanner();

    const notice = await screen.findByText(/Check-in van 08:14: Deze stap kan nu niet/);
    expect(notice).toBeInTheDocument();
    expect(readQueue(localStorage, KEY)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Melding sluiten' }));
    expect(screen.queryByText(/Check-in van 08:14/)).not.toBeInTheDocument();
  });

  it('zonder verbinding blijft de rij staan en toont de teller', async () => {
    seed('Check-in van 08:14', { rideId: 'rit-1', action: 'checkin' });
    runQueuedKind.mockRejectedValue(new TypeError('Failed to fetch'));

    renderBanner();

    expect(
      await screen.findByText(/1 registratie wacht op verbinding/),
    ).toBeInTheDocument();
    expect(readQueue(localStorage, KEY)).toHaveLength(1);
  });
});
