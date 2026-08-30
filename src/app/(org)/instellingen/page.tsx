import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Instellingen' };

export default async function SettingsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');

  const sections = [
    {
      href: '/instellingen/gebruikers' as Route,
      title: 'Gebruikers',
      description: 'Medewerkers, rollen en toegang.',
      permission: 'organization.members.view' as const,
    },
    {
      href: '/instellingen/branding' as Route,
      title: 'Huisstijl',
      description: 'Weergavenaam, logo, kleuren en supportgegevens.',
      permission: 'branding.manage' as const,
    },
    {
      href: '/instellingen/support' as Route,
      title: 'Privacy en support',
      description:
        'Bewaartermijnen, en tijdelijke toegang voor Tagpoint als u hulp nodig heeft.',
      permission: 'organization.manage' as const,
    },
    {
      href: '/instellingen/logboek' as Route,
      title: 'Logboek',
      description: 'Wie deed wat, en wanneer.',
      permission: 'audit.view' as const,
    },
    {
      href: '/instellingen/domeinen' as Route,
      title: 'Domeinnamen',
      description: 'Draai het platform op uw eigen domeinnaam.',
      permission: 'domain.manage' as const,
    },
  ].filter((section) => membership.permissions.has(section.permission));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Instellingen</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:bg-[var(--tp-surface-muted)]">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
