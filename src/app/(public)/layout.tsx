import Link from 'next/link';
import { BrandMark, PlatformCredit } from '@/features/branding/components/brand-mark';
import { getHostBranding } from '@/features/branding/host';

/**
 * Shell for the signed-out pages.
 *
 * On the platform's own host this is plain Tagpoint. On a tenant's verified
 * domain it shows their name and logo — a parent who was sent a link by their
 * transport company should not land on a login page belonging to a product
 * they have never heard of.
 *
 * There is no session yet, so the *only* thing available is the hostname. That
 * is why this is presentation and nothing else: the host decides what is
 * painted, never what may be read.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const branding = await getHostBranding();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="flex items-center">
        <BrandMark
          name={branding?.displayName ?? 'Tagpoint'}
          logoUrl={branding?.logoUrl}
          className="text-lg font-semibold tracking-tight"
          imageClassName="h-10 w-auto max-w-[12rem] object-contain"
        />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      {branding ? (
        <PlatformCredit visible={!branding.hidePlatformBranding} />
      ) : (
        <p className="text-xs text-[var(--tp-muted-foreground)]">Taxi Dispatch</p>
      )}
    </div>
  );
}
