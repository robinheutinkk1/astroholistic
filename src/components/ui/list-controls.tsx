'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';

/**
 * Search box and pagination for a server-rendered list.
 *
 * State lives in the URL rather than in React: a planner can bookmark or share
 * "all clients in Hengelo, page 3", and the back button behaves.
 */
function useUpdateParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return React.useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, value);
      }
      router.push(`${pathname}?${next.toString()}` as never);
    },
    [router, pathname, searchParams],
  );
}

export function SearchField({
  placeholder = 'Zoeken…',
  label,
}: {
  placeholder?: string;
  label: string;
}) {
  const searchParams = useSearchParams();
  const updateParams = useUpdateParams();
  const [value, setValue] = React.useState(searchParams.get('q') ?? '');

  // Debounced so typing does not fire a request per keystroke, but short enough
  // that the list feels live.
  React.useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (value === current) return;
    const timer = setTimeout(() => {
      // Any change to the filter returns to page one; staying on page 4 of a
      // now two-page result shows an empty screen.
      updateParams({ q: value, page: undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, searchParams, updateParams]);

  return (
    <div className="relative max-w-xs">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--tp-muted-foreground)]"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        className="pl-9"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
}: {
  page: number;
  pageCount: number;
  total: number;
}) {
  const updateParams = useUpdateParams();
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-sm text-[var(--tp-muted-foreground)]">
        {total} {total === 1 ? 'resultaat' : 'resultaten'} · pagina {page} van {pageCount}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => updateParams({ page: String(page - 1) })}
        >
          Vorige
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => updateParams({ page: String(page + 1) })}
        >
          Volgende
        </Button>
      </div>
    </div>
  );
}
