import Image from 'next/image';

/**
 * The tenant's name and logo, as shown in a header or on a signed-out page.
 *
 * One component for every shell, so a change to how a tenant is presented does
 * not have to be made four times — and so that no shell quietly keeps showing
 * the platform's own name (§67.11).
 *
 * The two className props are separate on purpose: a logo and a wordmark need
 * different classes (`h-8 w-auto object-contain` versus `truncate font-semibold`),
 * and a single prop would silently apply text classes to an image.
 */
export function BrandMark({
  name,
  logoUrl,
  className,
  imageClassName,
}: {
  name: string;
  logoUrl?: string | null | undefined;
  /** Applied when there is no logo and the name is rendered as text. */
  className?: string | undefined;
  /** Applied to the logo image. */
  imageClassName?: string | undefined;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        // The name, not "logo": for a screen reader the useful information is
        // whose site this is.
        alt={name}
        width={140}
        height={40}
        // The file already passed a format and size check on upload, and the
        // optimiser would mean proxying every tenant's logo through the app.
        unoptimized
        priority
        className={
          imageClassName ?? 'h-8 w-auto max-w-[10rem] object-contain object-left'
        }
      />
    );
  }

  return <span className={className ?? 'truncate text-base font-semibold'}>{name}</span>;
}

/** "Mogelijk gemaakt door Tagpoint", unless the tenant chooses to hide it. */
export function PlatformCredit({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <p className="text-xs text-[var(--tp-muted-foreground)]">
      Mogelijk gemaakt door Tagpoint
    </p>
  );
}
