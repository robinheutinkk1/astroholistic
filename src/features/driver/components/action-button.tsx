'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDriverSubmit } from '../offline/use-driver-submit';

/**
 * The big button a driver presses at each step of a ride.
 *
 * GPS is attached when the organisation enabled it AND the device grants it,
 * but a refused or slow fix must never block the action: the driver is standing
 * beside the vehicle and needs the ride to move on. The position is a nice-to-
 * have on the event, not a precondition (docs/SECURITY.md §9).
 *
 * Verstuurd via useDriverSubmit en niet via <form action>: een mislukte
 * verbinding wordt dan een wachtrijregel in plaats van een foutscherm, en de
 * GPS-stap is een gewone await in plaats van preventDefault + requestSubmit.
 * Die laatste constructie bleek bovendien een lus: requestSubmit vuurde de
 * onSubmit opnieuw af, die opnieuw preventDefault deed, en de actie kwam er
 * nooit doorheen zodra GPS aanstond.
 */
export function DriverActionButton({
  rideId,
  action,
  label,
  captureGps,
}: {
  rideId: string;
  action: string;
  label: string;
  captureGps: boolean;
}) {
  const { state, pending, submit } = useDriverSubmit('ride-action');
  const [locating, setLocating] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void locateAndSubmit(formData);
  }

  async function locateAndSubmit(formData: FormData) {
    if (captureGps && 'geolocation' in navigator) {
      setLocating(true);
      const fix = await currentPosition();
      setLocating(false);
      if (fix) {
        formData.set('latitude', String(fix.coords.latitude));
        formData.set('longitude', String(fix.coords.longitude));
        formData.set('accuracy', String(fix.coords.accuracy));
      }
    }

    const time = new Date().toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
    });
    submit(formData, `${label} van ${time}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <input type="hidden" name="rideId" value={rideId} />
      <input type="hidden" name="action" value={action} />

      <Button type="submit" size="touch" loading={pending || locating}>
        {locating ? 'Locatie bepalen…' : label}
      </Button>

      {state.status === 'error' ? (
        <p role="alert" className="mt-2 text-sm text-[var(--tp-danger)]">
          {state.message}
        </p>
      ) : null}
      {state.status === 'success' && state.message ? (
        <p role="status" className="mt-2 text-sm text-[var(--tp-muted-foreground)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * One GPS attempt with a hard timeout, as a promise that never rejects: a
 * device that will not answer must not leave the driver staring at a spinner
 * in the rain.
 */
function currentPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 30_000 },
    );
  });
}
