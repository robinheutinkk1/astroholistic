'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Het bord hangt aan de muur of ligt open op een balie; niemand drukt op F5.
 *
 * Een verse render elke dertig seconden is bewust verkozen boven een
 * realtime-abonnement: het bord toont een samenvatting, geen gebeurtenis, en
 * dertig seconden achterlopen is voor "is Jan er al" onmerkbaar. Het scheelt
 * een websocket per open tabblad. Een verborgen tabblad ververst niet.
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);

  return null;
}
