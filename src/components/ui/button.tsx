import * as React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

/**
 * Sizes note: `md` is the desktop default, but the driver PWA uses `touch`,
 * which is 56px tall. A driver taps these standing next to a vehicle, often in
 * the rain, sometimes wearing gloves (masterprompt §23, §48).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--tp-radius)] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--tp-primary)] text-[var(--tp-primary-foreground)] hover:opacity-90',
        secondary:
          'bg-[var(--tp-secondary)] text-[var(--tp-secondary-foreground)] hover:opacity-90',
        outline:
          'border border-[var(--tp-border)] bg-[var(--tp-surface)] text-[var(--tp-foreground)] hover:bg-[var(--tp-surface-muted)]',
        ghost: 'text-[var(--tp-foreground)] hover:bg-[var(--tp-surface-muted)]',
        danger:
          'bg-[var(--tp-danger)] text-[var(--tp-danger-foreground)] hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-sm [&_svg]:size-4',
        md: 'h-10 px-4 text-sm [&_svg]:size-4',
        lg: 'h-12 px-6 text-base [&_svg]:size-5',
        touch: 'h-14 w-full px-6 text-lg [&_svg]:size-6',
        icon: 'size-10 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner and blocks interaction. Prefer this over disabling alone,
   *  so the user gets feedback rather than an inert button (§46). */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    children,
    disabled,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      {/* Slottable marks which child Slot should merge into when asChild is
            set. Without it, the spinner makes Slot see two children and throw. */}
      <Slottable>{children}</Slottable>
    </Comp>
  );
});

export { buttonVariants };
