'use client';

import { createContext, useContext } from 'react';
import { storageKey } from './queue';

/**
 * Waar de wachtrij van déze chauffeur staat.
 *
 * Via context en niet als prop door elke knop heen: de sleutel bevat het
 * gebruikers-id (een gedeeld toestel mag de rij van de vorige chauffeur niet
 * afspelen), en dat id kent alleen de layout.
 */
const OfflineContext = createContext<string | null>(null);

/** Klinkt door het venster zodra de rij verandert, zodat de teller meetelt. */
export const QUEUE_CHANGED_EVENT = 'tp-driver-queue-changed';

export function DriverOfflineProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <OfflineContext.Provider value={storageKey(userId)}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useQueueKey(): string {
  const key = useContext(OfflineContext);
  if (!key) {
    // Buiten de chauffeursshell bestaat er geen wachtrij; dit is een
    // programmeerfout, geen gebruikerssituatie.
    throw new Error('useQueueKey hoort binnen DriverOfflineProvider te draaien.');
  }
  return key;
}
