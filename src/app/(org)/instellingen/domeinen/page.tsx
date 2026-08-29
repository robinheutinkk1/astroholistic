import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DomainManager } from '@/features/domains/components/domain-manager';
import { listDomains } from '@/features/domains/service';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Domeinnamen' };

export default async function DomainSettingsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('domain.manage')) redirect('/instellingen');

  const domains = await listDomains(membership.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Domeinnamen</h1>
        <p className="mt-1 max-w-prose text-sm text-[var(--tp-muted-foreground)]">
          Laat de planning, de chauffeurs-app en de portalen draaien op uw eigen
          domeinnaam. Bezoekers zien dan uw naam, logo en kleuren, ook voordat ze
          inloggen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eigen domeinnamen</CardTitle>
        </CardHeader>
        <CardContent>
          <DomainManager domains={domains} />
        </CardContent>
      </Card>
    </div>
  );
}
