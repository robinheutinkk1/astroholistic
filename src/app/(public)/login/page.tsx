import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignInForm } from '@/features/auth/components/sign-in-form';
import { getCurrentUser } from '@/features/rbac/session';

export const metadata: Metadata = { title: 'Inloggen' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reden?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const { next, reden, error } = await searchParams;

  // Zeggen waarom iemand hier is. Zonder deze regel lijkt automatisch uitloggen
  // op een storing, en dat is precies het moment waarop mensen gaan bellen.
  const notice =
    reden === 'verlopen'
      ? 'Je bent automatisch uitgelogd omdat er een tijd niets is gedaan. Log opnieuw in om verder te gaan.'
      : error === 'link_expired'
        ? 'Die link is verlopen of al gebruikt. Vraag een nieuwe aan.'
        : error === 'link_invalid'
          ? 'Die link is niet geldig. Vraag een nieuwe aan.'
          : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-lg">
          Inloggen
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice ? (
          <p
            role="status"
            className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface-muted)] p-3 text-sm"
          >
            {notice}
          </p>
        ) : null}
        <SignInForm redirectTo={next} />
      </CardContent>
    </Card>
  );
}
