import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils/cn';

/**
 * Wraps a form control with its label, hint and error message, and wires up the
 * aria-describedby/aria-invalid relationships.
 *
 * Doing this once here is why §48 (accessibility) does not have to be
 * remembered at every form: a field built with this component is announced
 * correctly by a screen reader by construction.
 */
export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <LabelPrimitive.Root
        htmlFor={htmlFor}
        className="text-sm font-medium text-[var(--tp-foreground)]"
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-[var(--tp-danger)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </LabelPrimitive.Root>

      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: htmlFor,
            'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
            'aria-invalid': error ? true : undefined,
            'aria-required': required || undefined,
          })
        : children}

      {hint ? (
        <p id={hintId} className="text-xs text-[var(--tp-muted-foreground)]">
          {hint}
        </p>
      ) : null}

      {error ? (
        // role="alert" so the message is announced when it appears after submit.
        <p id={errorId} role="alert" className="text-xs text-[var(--tp-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
