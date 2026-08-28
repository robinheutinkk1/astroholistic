import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getDriverContext } from '@/features/driver/service';
import { getCurrentUser } from '@/features/rbac/session';
import { signOutAction } from '@/features/auth/actions';
import { Button } from '@/components/ui/button';

/**
 * Always rendered per request: every screen here depends on who is signed in
 * and what is planned for them today. There is nothing to prerender.
 */
export const dynamic = 'force-dynamic';

/**
 * Shell for the driver PWA.
 *
 * Mobile-first, unlike the planner application (masterprompt §67.19). No
 * sidebar, no dense tables: one column, large targets, and the minimum of
 * chrome — a driver holds this in one hand beside a running vehicle.
 */
export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/driver');

  const context = await getDriverContext();

  // A signed-in account that is not a driver: a planner opening the driver URL,
  // or a driver whose record was removed. Explain it rather than showing an
  // empty day.
  if (!context) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">Geen chauffeursaccount</h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Dit account is niet gekoppeld aan een chauffeur. Vraag de planning om je account
          te koppelen.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Naar het dashboard</Link>
        </Button>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--tp-surface-muted)]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--tp-border)] bg-[var(--tp-surface)] px-4 py-3">
        <Link href="/driver" className="text-base font-semibold">
          Mijn ritten
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

      <main className="flex-1 p-4 pb-10">{children}</main>
    </div>
  );
}
