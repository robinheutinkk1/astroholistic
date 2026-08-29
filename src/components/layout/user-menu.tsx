'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, User } from 'lucide-react';
import { signOutAction } from '@/features/auth/actions';

/**
 * WAAROM `onSelect` EN GEEN FORMULIER. Dit menu had dezelfde fout als de
 * organisatiewisselaar: een <form> met een submit-knop binnen een
 * DropdownMenu.Item. Dat doet niets. Het menu-item vangt de klik af en sluit
 * het menu, waarna React het formulier weghaalt voordat de browser het kan
 * versturen -- uitloggen deed dus letterlijk niets, zonder foutmelding.
 *
 * Bijkomend probleem van diezelfde constructie: met `asChild` kreeg het <form>
 * `role="menuitem"` in plaats van de knop erin. Voor een schermlezer was het
 * een menu-item zonder bedienbare inhoud.
 *
 * `preventDefault()` houdt het menu open tot de actie is gestart.
 */
export function UserMenu({
  fullName,
  email,
  roleLabels,
}: {
  fullName: string | null;
  email: string;
  roleLabels: readonly string[];
}) {
  const [pending, startTransition] = useTransition();

  const initials = (fullName ?? email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Accountmenu"
        className="flex size-9 items-center justify-center rounded-full bg-[var(--tp-secondary)] text-sm font-medium text-[var(--tp-secondary-foreground)]"
      >
        {initials}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="min-w-56 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-1 shadow-md"
        >
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium">{fullName ?? email}</p>
            <p className="truncate text-xs text-[var(--tp-muted-foreground)]">{email}</p>
            {roleLabels.length > 0 ? (
              <p className="mt-1 text-xs text-[var(--tp-muted-foreground)]">
                {roleLabels.join(', ')}
              </p>
            ) : null}
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-[var(--tp-border)]" />

          <DropdownMenu.Item asChild>
            <Link
              href="/profiel"
              className="flex min-h-11 items-center gap-2 rounded-[calc(var(--tp-radius)-2px)] px-2 py-1.5 text-sm hover:bg-[var(--tp-surface-muted)]"
            >
              <User className="size-4" aria-hidden="true" />
              Mijn profiel
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            disabled={pending}
            onSelect={(event) => {
              event.preventDefault();
              startTransition(() => {
                void signOutAction();
              });
            }}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[calc(var(--tp-radius)-2px)] px-2 py-1.5 text-sm outline-none hover:bg-[var(--tp-surface-muted)] focus-visible:bg-[var(--tp-surface-muted)] data-[disabled]:opacity-60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {pending ? 'Uitloggen…' : 'Uitloggen'}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
