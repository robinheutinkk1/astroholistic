import { cn } from '@/lib/utils/cn';

/**
 * A single figure on the dashboard.
 *
 * `tone` only adds colour; the label always states what the number means. A
 * dispatcher scanning the board must not have to know that orange means
 * "problem" (§48).
 */
export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'neutral' | 'success' | 'info' | 'warning' | 'danger';
}) {
  const toneClass = {
    neutral: 'text-[var(--tp-foreground)]',
    success: 'text-[var(--color-status-completed)]',
    info: 'text-[var(--color-status-started)]',
    warning: 'text-[var(--tp-warning)]',
    danger: 'text-[var(--tp-danger)]',
  }[tone];

  return (
    <div className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-4">
      <p className="text-sm text-[var(--tp-muted-foreground)]">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', toneClass)}>{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--tp-muted-foreground)]">{hint}</p>
      ) : null}
    </div>
  );
}
