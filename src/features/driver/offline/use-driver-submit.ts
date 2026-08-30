'use client';

import { useState, useTransition } from 'react';
import { type FormState, IDLE } from '@/lib/errors/form-state';
import { enqueue, isConnectionFailure, type QueuedAction } from './queue';
import { QUEUE_CHANGED_EVENT, useQueueKey } from './context';
import { runQueuedKind } from './actions-map';

/**
 * Versturen met een vangnet.
 *
 * WAAROM NIET GEWOON <form action={...}>. Als de fetch van een server action
 * mislukt, gooit React de fout naar de dichtstbijzijnde foutgrens: de
 * chauffeur belandt op "Er ging iets mis" en zijn registratie is weg. Voor
 * een kantoorscherm is dat een hinderlijke onderbreking; voor een check-in in
 * een parkeergarage is het dataverlies.
 *
 * Deze hook roept de actie zelf aan en vangt het verschil: een antwoord van
 * de server (ook een afwijzing) wordt gewoon getoond, een verbindingsfout
 * wordt een wachtrijregel met het moment van de klik erbij. De banner in de
 * layout verstuurt die zodra er weer verbinding is.
 */
export const QUEUED_MESSAGE =
  'Geen verbinding. De registratie is bewaard en wordt automatisch verstuurd zodra er weer bereik is.';

export function useDriverSubmit(kind: QueuedAction['kind']) {
  const queueKey = useQueueKey();
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData, label: string) {
    // Het moment van de klik. Gaat mee in de directe poging én in de
    // wachtrijregel, zodat de administratie het werkelijke tijdstip draagt.
    const occurredAt = new Date().toISOString();
    formData.set('occurredAt', occurredAt);

    startTransition(async () => {
      try {
        setState(await runQueuedKind(kind, formData));
      } catch (error) {
        if (!isConnectionFailure(error, navigator.onLine)) {
          setState({
            status: 'error',
            message: 'Er ging iets mis. Probeer het opnieuw.',
          });
          return;
        }

        const fields: Record<string, string> = {};
        formData.forEach((value, name) => {
          if (typeof value === 'string') fields[name] = value;
        });

        enqueue(window.localStorage, queueKey, { kind, fields, occurredAt, label });
        window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
        setState({ status: 'success', message: QUEUED_MESSAGE });
      }
    });
  }

  return { state, pending, submit };
}
