'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Het vangnet onder elke pagina.
 *
 * Zonder dit bestand toont een onverwachte serverfout de kale standaardpagina
 * van het framework: Engels, zonder uitleg, zonder uitweg. Precies het
 * "Error 500"-gevoel dat dit product zijn gebruikers niet wil geven.
 *
 * WAT HIER BEWUST NIET STAAT: de foutmelding zelf. Next stuurt de details van
 * een serverfout toch al niet mee naar de browser (alleen een digest), en de
 * tekst van een fout kan interne paden of queryfragmenten bevatten. De digest
 * is genoeg om hem in de logboeken van de hosting terug te vinden.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Voor de eigen console van wie meekijkt; de server heeft hem al gelogd.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Er ging iets mis</h1>
      <p className="text-sm text-[var(--tp-muted-foreground)]">
        Dit lag niet aan iets wat je deed. Probeer het opnieuw; blijft dit scherm
        terugkomen, geef dan de code hieronder door aan de beheerder.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-[var(--tp-muted-foreground)]">
          {error.digest}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" onClick={reset}>
          Opnieuw proberen
        </Button>
        <Button asChild variant="outline">
          {/* Een echte <a> en geen router-link: na een fout is een verse
              paginalading betrouwbaarder dan navigeren binnen de kapotte boom. */}
          <a href="/">Naar het beginscherm</a>
        </Button>
      </div>
    </main>
  );
}
