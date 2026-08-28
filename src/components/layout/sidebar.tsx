'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  Car,
  Building2,
  LayoutDashboard,
  MapPin,
  Radio,
  Settings,
  Tag,
  Users,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { type Permission } from '@/features/rbac/permissions';

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: keyof typeof ICONS;
  readonly permission: Permission;
}

const ICONS = {
  dashboard: LayoutDashboard,
  planning: CalendarDays,
  dispatch: Radio,
  clients: Users,
  drivers: UserRound,
  vehicles: Car,
  locations: MapPin,
  care: Building2,
  tags: Tag,
  settings: Settings,
} as const;

/**
 * The navigation is filtered on the server before it reaches this component, so
 * a user never receives links to sections they cannot open. That is a
 * usability choice, not a security one — RLS decides what the pages return.
 */
export function Sidebar({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Hoofdnavigatie" className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href as never}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-[var(--tp-radius)] px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-[var(--tp-secondary)] font-medium text-[var(--tp-secondary-foreground)]'
                : 'text-[var(--tp-muted-foreground)] hover:bg-[var(--tp-surface-muted)]',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
