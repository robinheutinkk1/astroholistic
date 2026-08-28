import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/**
 * A native <select>. Deliberately not a custom listbox: the platform control is
 * keyboard- and screen-reader-correct for free, and on mobile it opens the
 * device's own picker — which is easier for a driver with gloves on than any
 * custom dropdown (§48).
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: readonly SelectOption[] }
>(function Select({ className, options, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] px-3 text-sm',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});
