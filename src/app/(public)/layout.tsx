import Link from 'next/link';

/**
 * Shell for the signed-out pages. Deliberately plain: at this point we do not
 * know which organisation the visitor belongs to, so there is no tenant
 * branding to apply yet.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        TagPoint
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-xs text-[var(--tp-muted-foreground)]">Taxi Dispatch</p>
    </div>
  );
}
