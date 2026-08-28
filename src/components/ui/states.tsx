import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from './button';

/**
 * The three states every data view needs besides "it worked" (§46).
 * They live together so a screen cannot ship with only two of them.
 */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded bg-[var(--tp-surface-muted)]', className)}
      {...props}
    />
  );
}

export function LoadingState({ label = 'Laden…' }: { label?: string }) {
  return (
    // role="status" makes the wait audible to a screen reader rather than silent.
    <div role="status" aria-live="polite" className="flex flex-col gap-3 p-6">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      {icon ? <div className="text-[var(--tp-muted-foreground)]">{icon}</div> : null}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-[var(--tp-muted-foreground)]">
          {description}
        </p>
      ) : null}
      {action ? (
        <Button className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description: string;
  /** Shown small and muted — useful in a bug report, meaningless to the user. */
  correlationId?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Er ging iets mis',
  description,
  correlationId,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 p-10 text-center"
    >
      <h3 className="text-sm font-semibold text-[var(--tp-danger)]">{title}</h3>
      <p className="max-w-sm text-sm text-[var(--tp-muted-foreground)]">{description}</p>
      {correlationId ? (
        <p className="font-mono text-xs text-[var(--tp-muted-foreground)]">
          Referentie: {correlationId}
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" className="mt-2" onClick={onRetry}>
          Opnieuw proberen
        </Button>
      ) : null}
    </div>
  );
}
