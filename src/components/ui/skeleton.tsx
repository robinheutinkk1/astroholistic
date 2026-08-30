import { cn } from '@/lib/utils/cn';

/**
 * Wat er staat terwijl de server nog rekent.
 *
 * Het verschil tussen "traag" en "bezig" zit in wat je toont tijdens het
 * wachten: een leeg scherm voelt kapot, een skelet zegt dat er iets aankomt.
 *
 * `motion-reduce:animate-none`: wie animaties heeft uitgezet krijgt stilstaande
 * blokken. De vorm draagt de boodschap al; het pulseren is aankleding.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-[var(--tp-radius)] bg-[var(--tp-surface-muted)] motion-reduce:animate-none',
        className,
      )}
    />
  );
}

/**
 * Het standaardskelet voor een lijstpagina: een kop, wat regels, een kaart.
 *
 * Bewust generiek. Een skelet dat de echte pagina te precies nadoet moet bij
 * elke wijziging mee veranderen, en loopt dan gegarandeerd achter; een vage
 * vorm veroudert niet.
 */
export function PageSkeleton() {
  return (
    <output
      aria-live="polite"
      aria-label="Bezig met laden"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-5">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-full max-w-sm" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      </div>
    </output>
  );
}
