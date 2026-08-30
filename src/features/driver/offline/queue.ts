/**
 * De wachtrij voor chauffeurshandelingen zonder verbinding.
 *
 * WAAROM LOCALSTORAGE EN GEEN SERVICE WORKER. Background Sync bestaat niet op
 * iOS, en chauffeurs rijden met iPhones. localStorage overleeft het sluiten
 * van de PWA, werkt op elk toestel, en de wachtrij is klein: hooguit een
 * handvol registraties uit één dienst.
 *
 * WAT HIER BEWUST NIET IN ZIT: de logica van het verzenden. Deze module weet
 * niets van server actions of van React; hij bewaart, leest en verwijdert.
 * Dat is wat hem testbaar maakt zonder browser.
 *
 * De sleutel bevat het gebruikers-id. Een gedeeld toestel waar chauffeur B
 * inlogt na chauffeur A mag de wachtrij van A niet als B afspelen. De server
 * zou dat ook weigeren (de rit staat niet op naam van B), maar dan met een
 * foutmelding die B niet kan plaatsen.
 */

export interface QueuedAction {
  readonly id: string;
  readonly kind: 'ride-action' | 'stop-arrived' | 'absence' | 'problem';
  /** De formuliervelden zoals ze op het moment van de klik waren, GPS incluis. */
  readonly fields: Readonly<Record<string, string>>;
  /** Het moment van de klik, niet van het verzenden. */
  readonly occurredAt: string;
  /** Wat er in de melding staat als dit niet meer verwerkt kan worden. */
  readonly label: string;
  readonly attempts: number;
}

/**
 * Na zoveel mislukte pogingen die géén verbindingsfout waren, valt een
 * registratie uit de rij. Zonder plafond blijft één gifpil eeuwig rondtollen
 * en houdt hij alles erachter tegen.
 */
export const MAX_ATTEMPTS = 20;

export function storageKey(userId: string): string {
  return `tp-driver-queue:${userId}`;
}

type StringStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readQueue(store: StringStore, key: string): QueuedAction[] {
  try {
    const raw = store.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Alleen rijen die er compleet uitzien; een half serialisatie-ongeluk mag
    // de rest van de wachtrij niet meeslepen.
    return parsed.filter(
      (entry): entry is QueuedAction =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as QueuedAction).id === 'string' &&
        typeof (entry as QueuedAction).kind === 'string' &&
        typeof (entry as QueuedAction).occurredAt === 'string' &&
        typeof (entry as QueuedAction).fields === 'object',
    );
  } catch {
    return [];
  }
}

function writeQueue(store: StringStore, key: string, queue: QueuedAction[]): void {
  try {
    if (queue.length === 0) store.removeItem(key);
    else store.setItem(key, JSON.stringify(queue));
  } catch {
    // Volle of geblokkeerde opslag. De directe poging is al mislukt en dit was
    // het vangnet onder het vangnet; meer dan doorgaan zit er dan niet in.
  }
}

export function enqueue(
  store: StringStore,
  key: string,
  entry: Omit<QueuedAction, 'id' | 'attempts'>,
): QueuedAction {
  const queued: QueuedAction = { ...entry, id: crypto.randomUUID(), attempts: 0 };
  writeQueue(store, key, [...readQueue(store, key), queued]);
  return queued;
}

export function removeEntry(store: StringStore, key: string, id: string): void {
  writeQueue(
    store,
    key,
    readQueue(store, key).filter((entry) => entry.id !== id),
  );
}

/** Telt een mislukte poging; boven het plafond verdwijnt de registratie. */
export function bumpAttempts(
  store: StringStore,
  key: string,
  id: string,
): 'kept' | 'dropped' {
  const queue = readQueue(store, key);
  const entry = queue.find((candidate) => candidate.id === id);
  if (!entry) return 'dropped';

  if (entry.attempts + 1 >= MAX_ATTEMPTS) {
    writeQueue(
      store,
      key,
      queue.filter((candidate) => candidate.id !== id),
    );
    return 'dropped';
  }

  writeQueue(
    store,
    key,
    queue.map((candidate) =>
      candidate.id === id
        ? { ...candidate, attempts: candidate.attempts + 1 }
        : candidate,
    ),
  );
  return 'kept';
}

/**
 * Is dit een verbindingsfout, of een echt antwoord van de server?
 *
 * Het verschil bepaalt alles: een verbindingsfout betekent bewaren en later
 * opnieuw, een serverantwoord betekent verwerken en uit de rij. De browser
 * geeft een mislukte fetch geen nette code mee, dus dit is patroonherkenning
 * op de meldingen die Chrome, Safari en Firefox daarvoor gebruiken — plus
 * navigator.onLine als die expliciet nee zegt.
 */
export function isConnectionFailure(error: unknown, onLine: boolean): boolean {
  if (!onLine) return true;
  if (!(error instanceof Error)) return false;
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(
    error.message,
  );
}
