import { beforeEach, describe, expect, it } from 'vitest';
import {
  bumpAttempts,
  enqueue,
  isConnectionFailure,
  MAX_ATTEMPTS,
  readQueue,
  removeEntry,
  storageKey,
} from './queue';

/**
 * De wachtrij is de plek waar een check-in leeft tussen "geklikt in een
 * parkeergarage" en "aangekomen bij de server". Alles wat hier misgaat is
 * onzichtbaar dataverlies, dus elk randgeval krijgt zijn eigen bewijs.
 */

function makeStore(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  };
}

const KEY = storageKey('chauffeur-1');

const ENTRY = {
  kind: 'ride-action' as const,
  fields: { rideId: 'rit-1', action: 'checkin' },
  occurredAt: '2026-08-30T08:14:00.000Z',
  label: 'Check-in van 08:14',
};

let store: Storage;
beforeEach(() => {
  store = makeStore();
});

describe('bewaren en teruglezen', () => {
  it('een registratie overleeft de rondgang door de opslag', () => {
    enqueue(store, KEY, ENTRY);

    const queue = readQueue(store, KEY);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.fields['rideId']).toBe('rit-1');
    expect(queue[0]!.occurredAt).toBe(ENTRY.occurredAt);
    expect(queue[0]!.attempts).toBe(0);
  });

  it('de volgorde blijft de volgorde van klikken', () => {
    // Instappen vóór rijden. Een wachtrij die herschikt maakt van een geldige
    // reeks statusovergangen een ongeldige.
    enqueue(store, KEY, { ...ENTRY, label: 'eerste' });
    enqueue(store, KEY, { ...ENTRY, label: 'tweede' });
    enqueue(store, KEY, { ...ENTRY, label: 'derde' });

    expect(readQueue(store, KEY).map((entry) => entry.label)).toEqual([
      'eerste',
      'tweede',
      'derde',
    ]);
  });

  it('kapotte opslag betekent een lege rij, geen crash', () => {
    store.setItem(KEY, 'geen json {');
    expect(readQueue(store, KEY)).toEqual([]);

    store.setItem(KEY, JSON.stringify({ niet: 'een array' }));
    expect(readQueue(store, KEY)).toEqual([]);
  });

  it('een half kapotte rij sleept de rest niet mee', () => {
    enqueue(store, KEY, ENTRY);
    const raw = JSON.parse(store.getItem(KEY)!) as unknown[];
    raw.push({ rommel: true });
    store.setItem(KEY, JSON.stringify(raw));

    expect(readQueue(store, KEY)).toHaveLength(1);
  });

  it('elke chauffeur heeft zijn eigen rij', () => {
    // Een gedeeld toestel: de wachtrij van A mag nooit als B worden afgespeeld.
    enqueue(store, storageKey('chauffeur-a'), ENTRY);
    expect(readQueue(store, storageKey('chauffeur-b'))).toEqual([]);
  });
});

describe('verwijderen en opgeven', () => {
  it('verwerkt is weg', () => {
    const queued = enqueue(store, KEY, ENTRY);
    removeEntry(store, KEY, queued.id);
    expect(readQueue(store, KEY)).toEqual([]);
    // En de sleutel zelf ook: een lege rij hoort geen spoor achter te laten.
    expect(store.getItem(KEY)).toBeNull();
  });

  it('een gifpil valt na het plafond uit de rij', () => {
    // Zonder plafond blokkeert een registratie die eeuwig faalt alles erachter.
    const queued = enqueue(store, KEY, ENTRY);

    // Negentien mislukte pogingen blijven staan; de twintigste is de laatste.
    for (let attempt = 0; attempt < MAX_ATTEMPTS - 1; attempt += 1) {
      expect(bumpAttempts(store, KEY, queued.id)).toBe('kept');
    }
    expect(bumpAttempts(store, KEY, queued.id)).toBe('dropped');
    expect(readQueue(store, KEY)).toEqual([]);
  });
});

describe('verbindingsfout of serverantwoord', () => {
  it('offline volgens de browser is altijd een verbindingsfout', () => {
    expect(isConnectionFailure(new Error('wat dan ook'), false)).toBe(true);
  });

  it('de bekende fetch-meldingen van de drie browsers', () => {
    for (const message of [
      'Failed to fetch', // Chrome
      'Load failed', // Safari
      'NetworkError when attempting to fetch resource.', // Firefox
      'fetch failed', // Node/undici
    ]) {
      expect(isConnectionFailure(new TypeError(message), true), message).toBe(true);
    }
  });

  it('een gewone fout is geen verbindingsfout', () => {
    // Die moet verwerkt worden, niet eeuwig opnieuw geprobeerd.
    expect(isConnectionFailure(new Error('kolom bestaat niet'), true)).toBe(false);
    expect(isConnectionFailure('geen Error', true)).toBe(false);
  });
});
