'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { IDLE, type FormState } from '@/lib/errors/form-state';
import { driverActionAction } from '../actions';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="touch" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * The big button a driver presses at each step of a ride.
 *
 * GPS is attached when the organisation enabled it AND the device grants it,
 * but a refused or slow fix must never block the action: the driver is standing
 * beside the vehicle and needs the ride to move on. The position is a nice-to-
 * have on the event, not a precondition (docs/SECURITY.md §9).
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
  const [state, formAction] = useActionState<FormState, FormData>(
    driverActionAction,
    IDLE,
  );
  const [locating, setLocating] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!captureGps || !('geolocation' in navigator)) return;

    event.preventDefault();
    setLocating(true);

    const form = event.currentTarget;
    const finish = () => {
      setLocating(false);
      form.requestSubmit();
    };

    // A hard timeout so a device that never resolves does not leave the driver
    // staring at a spinner in the rain.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setField(form, 'latitude', String(position.coords.latitude));
        setField(form, 'longitude', String(position.coords.longitude));
        setField(form, 'accuracy', String(position.coords.accuracy));
        finish();
      },
      () => finish(),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 30_000 },
    );
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="w-full">
      <input type="hidden" name="rideId" value={rideId} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="latitude" />
      <input type="hidden" name="longitude" />
      <input type="hidden" name="accuracy" />

      <Submit label={locating ? 'Locatie bepalen…' : label} />

      {state.status === 'error' ? (
        <p role="alert" className="mt-2 text-sm text-[var(--tp-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function setField(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement) field.value = value;
}
