'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addDays } from '@/lib/datetime/timezone';

const LONG_DATE = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function DayNavigator({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('datum', next);
    router.push(`${pathname}?${params.toString()}` as never);
  };

  // Parsed as UTC so the label never shifts a day near midnight.
  const label = LONG_DATE.format(new Date(`${date}T12:00:00Z`));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Vorige dag"
        onClick={() => go(addDays(date, -1))}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>

      <div className="min-w-56">
        <p className="text-sm font-medium first-letter:uppercase">{label}</p>
        {date !== today ? (
          <button
            type="button"
            onClick={() => go(today)}
            className="text-xs text-[var(--tp-muted-foreground)] underline underline-offset-2"
          >
            Terug naar vandaag
          </button>
        ) : (
          <p className="text-xs text-[var(--tp-muted-foreground)]">Vandaag</p>
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        aria-label="Volgende dag"
        onClick={() => go(addDays(date, 1))}
      >
        <ChevronRight aria-hidden="true" />
      </Button>

      <input
        type="date"
        aria-label="Kies een datum"
        value={date}
        onChange={(event) => go(event.target.value)}
        className="h-10 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] px-3 text-sm"
      />
    </div>
  );
}
