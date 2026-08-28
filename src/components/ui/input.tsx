import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] px-3 py-2 text-sm',
        'placeholder:text-[var(--tp-muted-foreground)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-[var(--tp-danger)]',
        className,
      )}
      {...props}
    />
  );
});
