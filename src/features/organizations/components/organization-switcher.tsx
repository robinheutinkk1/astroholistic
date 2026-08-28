'use client';

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
 */
export function OrganizationSwitcher({
  options,
  activeId,
}: {
  options: readonly SwitcherOption[];
  activeId: string;
}) {
  const active = options.find((option) => option.id === activeId);
  if (options.length < 2) {
    return <span className="text-sm font-medium">{active?.name}</span>;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 rounded-[var(--tp-radius)] px-2 py-1.5 text-sm font-medium hover:bg-[var(--tp-surface-muted)]">
        {active?.name}
        <ChevronsUpDown className="size-4 opacity-60" aria-hidden="true" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="min-w-56 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-1 shadow-md"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs text-[var(--tp-muted-foreground)]">
            Wisselen van organisatie
          </DropdownMenu.Label>
          {options.map((option) => (
            <DropdownMenu.Item key={option.id} asChild>
              <form action={switchOrganizationAction}>
                <input type="hidden" name="organizationId" value={option.id} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-[calc(var(--tp-radius)-2px)] px-2 py-1.5 text-left text-sm hover:bg-[var(--tp-surface-muted)]"
                >
                  {option.name}
                  {option.id === activeId ? (
                    <Check className="size-4" aria-label="Actief" />
                  ) : null}
                </button>
              </form>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
