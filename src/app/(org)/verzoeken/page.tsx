import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RequestReview } from '@/features/portals/components/request-review';
import { listRequests } from '@/features/portals/review';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Verzoeken' };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ alles?: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('change_requests.view')) redirect('/dashboard');

  const { alles } = await searchParams;
  const requests = await listRequests(
    membership.organizationId,
    alles === '1' ? 'ALL' : 'PENDING',
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Verzoeken</h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Afmeldingen en wijzigingen die cliënten, ouders of opdrachtgevers doorgeven.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{alles === '1' ? 'Alle verzoeken' : 'Openstaand'}</CardTitle>
          <CardDescription>
            Portalen wijzigen zelf nooit een rit. Wat hier binnenkomt is een verzoek,
            zodat er altijd iemand is die het besluit neemt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestReview
            requests={requests}
            canReview={membership.permissions.has('change_requests.review')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
