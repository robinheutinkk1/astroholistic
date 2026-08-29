import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckinPanel } from '@/features/tags/components/checkin-panel';
import { getCurrentUser } from '@/features/rbac/session';
import { isPlausibleToken } from '@/features/tags/token';

/**
 * The page an NFC tap or a QR scan lands on.
 *
 * THE STRICTEST RULE IN THE PRODUCT (docs/NFC.md §5): this page shows no
 * personal data to anyone who is not signed in. Not the client's name, not the
 * organisation, and not even whether the token exists.
 *
 * A malformed token, an unknown token and a valid token belonging to another
 * organisation all render exactly the same thing. Anything else turns the URL
 * into an oracle for finding real tags.
 */
export const metadata: Metadata = {
  title: 'Tagpoint',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function TagLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();

  // Note what is NOT done here: no database lookup before authentication. An
  // anonymous visitor cannot make this page touch the tag table at all.
  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-6 text-center">
        <p className="text-lg font-semibold">Tagpoint</p>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Deze tag hoort bij een vervoersorganisatie. Log in om verder te gaan.
        </p>
        <Button asChild size="touch">
          <Link href={`/login?next=${encodeURIComponent(`/t/${token}`)}`}>Inloggen</Link>
        </Button>
        <p className="text-xs text-[var(--tp-muted-foreground)]">
          Gevonden zonder dat je hier iets mee te maken hebt? Lever hem in bij de
          vervoerder die op de achterkant staat.
        </p>
      </main>
    );
  }

  // Even signed in, a malformed token is answered without a query.
  if (!isPlausibleToken(token)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold">Tag niet herkend</p>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Deze code klopt niet. Scan opnieuw, of check de cliënt handmatig in via je
          rittenlijst.
        </p>
        <Button asChild variant="outline" size="touch">
          <Link href="/driver">Naar mijn ritten</Link>
        </Button>
      </main>
    );
  }

  return <CheckinPanel token={token} />;
}
