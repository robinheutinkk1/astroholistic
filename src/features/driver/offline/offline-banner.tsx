'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { bumpAttempts, isConnectionFailure, readQueue, removeEntry } from './queue';
import { QUEUE_CHANGED_EVENT, useQueueKey } from './context';
import { runQueuedKind } from './actions-map';

const RETRY_INTERVAL_MS = 20_000;

interface DroppedNotice {
  readonly id: string;
  readonly text: string;
}

/**
 * De teller boven de dagplanning: "2 registraties wachten op verbinding".
 *
 * De banner is óók de verzender. Hij probeert de wachtrij opnieuw bij het
 * openen van de app, zodra de browser meldt dat er weer verbinding is, en
 * verder elke twintig seconden. Sequentieel en in klikvolgorde, want
 * "instappen" vóór "rijden" is geen detail maar de statusmachine.
 *
 * Een antwoord van de server — ook een afwijzing — haalt de regel uit de rij.
 * Een afwijzing ("deze stap kan nu niet") betekent dat de wereld intussen is
 * veranderd, bijvoorbeeld doordat de planner de rit al heeft bijgewerkt;
 * eeuwig opnieuw proberen maakt dat niet anders. De chauffeur krijgt er een
 * wegklikbare melding van, want stilzwijgend laten verdwijnen is erger.
 */
export function OfflineBanner() {
  const queueKey = useQueueKey();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [notices, setNotices] = useState<DroppedNotice[]>([]);
  const replaying = useRef(false);

  const replay = useCallback(async () => {
    if (replaying.current) return;
    replaying.current = true;

    let delivered = 0;
    try {
      // De rij per stap opnieuw lezen: een klik tijdens het verzenden mag
      // niet verdwijnen omdat wij met een oude kopie werkten.
      for (;;) {
        const [entry] = readQueue(window.localStorage, queueKey);
        if (!entry) break;

        const formData = new FormData();
        for (const [name, value] of Object.entries(entry.fields)) {
          formData.set(name, value);
        }

        try {
          const result = await runQueuedKind(entry.kind, formData);
          removeEntry(window.localStorage, queueKey, entry.id);
          if (result.status === 'error') {
            setNotices((current) => [
              ...current,
              {
                id: entry.id,
                text: `${entry.label}: ${result.message ?? 'kon niet meer worden verwerkt.'}`,
              },
            ]);
          } else {
            delivered += 1;
          }
        } catch (error) {
          if (isConnectionFailure(error, navigator.onLine)) break;

          // Geen verbindingsfout maar ook geen antwoord: tel de poging en
          // stop deze ronde. Boven het plafond valt de regel uit de rij.
          if (bumpAttempts(window.localStorage, queueKey, entry.id) === 'dropped') {
            setNotices((current) => [
              ...current,
              { id: entry.id, text: `${entry.label}: kon niet meer worden verwerkt.` },
            ]);
          }
          break;
        }
      }
    } finally {
      replaying.current = false;
      setCount(readQueue(window.localStorage, queueKey).length);
      // De pagina toont nu oude statussen; na een geslaagde bezorging haalt
      // een verse render de werkelijkheid op.
      if (delivered > 0) router.refresh();
    }
  }, [queueKey, router]);

  useEffect(() => {
    const sync = () => {
      setCount(readQueue(window.localStorage, queueKey).length);
      void replay();
    };

    sync();
    window.addEventListener('online', sync);
    window.addEventListener(QUEUE_CHANGED_EVENT, sync);
    const timer = window.setInterval(sync, RETRY_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener(QUEUE_CHANGED_EVENT, sync);
      window.clearInterval(timer);
    };
  }, [queueKey, replay]);

  if (count === 0 && notices.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      {count > 0 ? (
        <p className="rounded-[var(--tp-radius)] border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {count === 1
            ? '1 registratie wacht op verbinding en wordt automatisch verstuurd.'
            : `${count} registraties wachten op verbinding en worden automatisch verstuurd.`}
        </p>
      ) : null}

      {notices.map((notice) => (
        <p
          key={notice.id}
          className="flex items-start justify-between gap-3 rounded-[var(--tp-radius)] border border-[var(--tp-danger)] bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          <span>Niet meer verwerkt — {notice.text}</span>
          <button
            type="button"
            aria-label="Melding sluiten"
            className="font-semibold underline underline-offset-2"
            onClick={() =>
              setNotices((current) => current.filter((item) => item.id !== notice.id))
            }
          >
            OK
          </button>
        </p>
      ))}
    </div>
  );
}
