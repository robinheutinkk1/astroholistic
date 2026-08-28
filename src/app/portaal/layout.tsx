import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/features/rbac/session';
import { getPortalAccess } from '@/features/portals/access';
import { signOutAction } from '@/features/auth/actions';
import { BrandMark } from '@/features/branding/components/brand-mark';
import { readBrandingForViewer } from '@/features/branding/service';
import { brandName, brandStyle } from '@/features/branding/theme';
import { logoUrl } from '@/features/branding/url';

/**
 * Shell for the client, contact and care-organisation portal.
 *
 * Responsive rather than mobile-first: a parent checks this on a phone, a care
 * co-ordinator on a desktop (masterprompt §46).
 */
export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/portaal');

  const access = await getPortalAccess();

  // A signed-in account with no linked client: a former contact, or a planner
  // who opened the portal URL. Explain rather than show an empty page.
  if (access.clients.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">Nog geen toegang</h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Dit account is niet gekoppeld aan een cliënt. Neem contact op met de vervoerder
          als dat wel zou moeten.
        </p>
      </main>
    );
  }

  // Only brand when every client this viewer reaches belongs to the same
  // organisation. A contact linked to two transport companies has no single
  // "their" company, and picking one would tell them, wrongly, whose site this
  // is. In that case the platform's own presentation is the honest answer.
  const organizationIds = new Set(access.clients.map((client) => client.organizationId));
  const soleOrganizationId =
    organizationIds.size === 1 ? [...organizationIds][0] : undefined;
  const branding = soleOrganizationId
    ? await readBrandingForViewer(soleOrganizationId)
    : null;

  return (
    <div
      style={brandStyle(branding)}
      className="flex min-h-dvh flex-col bg-[var(--tp-surface-muted)]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[var(--tp-border)] bg-[var(--tp-surface)] px-4 py-3">
        <Link href="/portaal" className="flex min-w-0 items-center gap-2">
          <BrandMark
            name={brandName(branding, 'Mijn vervoer')}
            logoUrl={logoUrl(branding?.logo_path, branding?.updated_at)}
          />
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="min-h-11 px-2 text-sm text-[var(--tp-muted-foreground)]"
          >
            Uitloggen
          </button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 p-4 pb-10">{children}</main>
    </div>
  );
}
