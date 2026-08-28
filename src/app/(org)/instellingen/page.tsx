import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-[var(--tp-muted-foreground)]">
                Branding, domeinen en organisatiegegevens volgen in Fase 10.
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
