'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Sidebar, type NavItem } from './sidebar';

/**
 * Navigatie op een telefoon.
 *
 * De zijbalk is `hidden md:block`, en daar stond niets tegenover: op een
 * telefoon had een planner geen enkele manier om ergens heen te gaan. Alleen de
 * pagina waarop hij toevallig binnenkwam, en verder niets.
 *
 * Een lade in plaats van een uitklapmenu, omdat de lijst tien items lang kan
 * zijn en die passen niet onder een knop. Hij sluit bij een routewijziging —
 * zonder dat blijft hij openstaan over de pagina die je net hebt geopend.
 */
export function MobileNav({
  items,
  title,
}: {
  items: readonly NavItem[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Sluiten bij navigatie. Tijdens het renderen bijwerken in plaats van in een
  // effect: zo is de lade al dicht bij de eerste weergave van de nieuwe pagina,
  // in plaats van zichtbaar dicht te klappen erna.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Menu openen"
          // 44px is het kleinste doel dat een duim betrouwbaar raakt (§48).
          className="flex size-11 shrink-0 items-center justify-center rounded-[var(--tp-radius)] text-[var(--tp-foreground)] hover:bg-[var(--tp-surface-muted)] md:hidden"
        >
          <Menu className="size-6" aria-hidden="true" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 md:hidden" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-[var(--tp-surface)] shadow-xl md:hidden"
          aria-describedby={undefined}
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--tp-border)] px-4">
            <Dialog.Title className="truncate text-sm font-semibold">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Menu sluiten"
                className="flex size-11 shrink-0 items-center justify-center rounded-[var(--tp-radius)] hover:bg-[var(--tp-surface-muted)]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Dezelfde component als op desktop: één lijst, één plek waar het
              actieve item wordt bepaald, geen tweede versie die achterloopt. */}
          <Sidebar items={items} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
