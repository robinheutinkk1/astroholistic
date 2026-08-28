import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/features/rbac/session';
import { getPortalAccess } from '@/features/portals/access';
import { signOutAction } from '@/features/auth/actions';

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

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--tp-surface-muted)]">
      <header className="flex items-center justify-between border-b border-[var(--tp-border)] bg-[var(--tp-surface)] px-4 py-3">
        <Link href="/portaal" className="text-base font-semibold">
          Mijn vervoer
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
