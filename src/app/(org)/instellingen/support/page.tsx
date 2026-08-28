import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { RetentionForm } from '@/features/support/components/retention-form';
import { SupportManager } from '@/features/support/components/support-manager';
import { getRetention, listGrants, listPlatformStaff } from '@/features/support/service';

export const metadata: Metadata = { title: 'Support-toegang' };
export const dynamic = 'force-dynamic';

export default async function SupportAccessPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('organization.manage')) redirect('/instellingen');

  const [grants, staff, retention] = await Promise.all([
    listGrants(membership.organizationId),
    listPlatformStaff(membership.organizationId),
    getRetention(membership.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Privacy en support</h1>
        <p className="mt-1 max-w-prose text-sm text-[var(--tp-muted-foreground)]">
          Medewerkers van TagPoint kunnen uw gegevens <strong>niet</strong> inzien. Wilt u
          hulp bij een vraag waarvoor dat wel nodig is, dan geeft u hier zelf tijdelijk
          toegang. Die loopt vanzelf af en u kunt hem op elk moment intrekken.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tijdelijke toegang geven</CardTitle>
          <CardDescription>
            Support kan alleen meekijken, nooit iets wijzigen. Wat er tijdens de toegang
            gebeurt, staat in het logboek van uw organisatie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupportManager grants={grants} staff={staff} now={Date.now()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bewaartermijn</CardTitle>
          <CardDescription>
            Hoe lang gegevens van een cliënt bewaard blijven nadat er geen ritten meer
            zijn. U bent de verwerkingsverantwoordelijke, dus dit is uw keuze.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RetentionForm retention={retention} />
        </CardContent>
      </Card>
    </div>
  );
}
