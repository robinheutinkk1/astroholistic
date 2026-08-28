'use client';

import { useTransition } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { switchOrganizationAction } from '../actions';

export interface SwitcherOption {
  readonly id: string;
  readonly name: string;
}

/**
 * Only rendered when the user belongs to more than one organisation. Showing a
 * "switcher" with a single entry is noise.
 *
 * WAAROM `onSelect` EN GEEN FORMULIER. De eerste versie zette een <form> met
 * een submit-knop binnenin elk menu-item. Dat deed niets: een menu-item vangt
 * de klik af en sluit het menu, dus React haalde het formulier weg voordat de
 * browser het kon versturen. `preventDefault()` houdt het menu open tot de
 * actie is gestart.
 */
export function OrganizationSwitcher({
  options,
  activeId,
}: {
  options: readonly SwitcherOption[];
  activeId: string;
}) {
  const [pending, startTransition] = useTransition();
  const active = options.find((option) => option.id === activeId);

  if (options.length < 2) {
    return <span className="truncate text-sm font-medium">{active?.name}</span>;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={pending}
        className="flex min-w-0 items-center gap-2 rounded-[var(--tp-radius)] px-2 py-1.5 text-sm font-medium hover:bg-[var(--tp-surface-muted)] disabled:opacity-60"
      >
        <span className="truncate">{pending ? 'Wisselen…' : active?.name}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 max-w-[90vw] min-w-56 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-1 shadow-md"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs text-[var(--tp-muted-foreground)]">
            Wisselen van organisatie
          </DropdownMenu.Label>

          {options.map((option) => (
            <DropdownMenu.Item
              key={option.id}
              // Het menu niet meteen laten sluiten: anders verdwijnt dit item
              // terwijl de overgang nog moet beginnen.
              onSelect={(event) => {
                event.preventDefault();
                if (option.id === activeId) return;
                startTransition(async () => {
                  await switchOrganizationAction(option.id);
                });
              }}
              className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[calc(var(--tp-radius)-2px)] px-2 py-1.5 text-left text-sm outline-none data-[highlighted]:bg-[var(--tp-surface-muted)]"
            >
              <span className="truncate">{option.name}</span>
              {option.id === activeId ? (
                <Check className="size-4 shrink-0" aria-label="Actief" />
              ) : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
