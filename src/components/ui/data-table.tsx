import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * A plain, accessible table.
 *
 * Deliberately not a generic "smart" table component: sorting and pagination
 * are server-side (docs/ARCHITECTURE.md), so this only renders. Keeping it dumb
 * is what allows every list screen to look the same without inheriting a
 * feature it does not need.
 */
export function Table({
  caption,
  children,
  className,
}: {
  caption: string;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    // Wide tables scroll inside their own container instead of pushing the page
    // sideways on a laptop screen.
    <div className="overflow-x-auto">
      <table className={cn('w-full min-w-[36rem] border-collapse text-sm', className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[var(--tp-border)] text-left">{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  className,
  scope = 'col',
}: {
  children: React.ReactNode;
  className?: string | undefined;
  scope?: 'col' | 'row';
}) {
  return (
    <th
      scope={scope}
      className={cn('py-2 pr-4 font-medium whitespace-nowrap', className)}
    >
      {children}
    </th>
  );
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <tr className={cn('border-b border-[var(--tp-border)] last:border-0', className)}>
      {children}
    </tr>
  );
}

export function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return <td className={cn('py-3 pr-4 align-top', className)}>{children}</td>;
}
