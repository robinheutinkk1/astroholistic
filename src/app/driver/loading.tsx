import { Skeleton } from '@/components/ui/skeleton';

/** De dagplanning van de chauffeur: kaarten met één grote knop eronder. */
export default function Loading() {
  return (
    <output
      aria-live="polite"
      aria-label="Bezig met laden"
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-6 w-40" />
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-4"
        >
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ))}
    </output>
  );
}
