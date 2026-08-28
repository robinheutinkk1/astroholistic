import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />;
}

/**
 * The heading level is a prop because it depends on where the card sits.
 *
 * Inside a page that already has its own <h1>, a card title is a subheading and
 * `h3` is right. On a page that *is* one card — the sign-in and password
 * screens — the card title is the page heading, and defaulting to `h3` left
 * those pages with no <h1> at all and a heading level skipped from nothing to
 * three. A screen reader announces such a page with no title (§48). Found by
 * the end-to-end suite in fase 13.
 */
export function CardTitle({
  className,
  as: Heading = 'h3',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <Heading
      className={cn('text-base leading-none font-semibold tracking-tight', className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-[var(--tp-muted-foreground)]', className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2 p-5 pt-0', className)} {...props} />;
}
