import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/data-table';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { Pagination, SearchField } from '@/components/ui/list-controls';
import { Badge } from '@/components/ui/badge';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { resolveListParams } from '@/lib/pagination';
import { listCareOrganizations } from '@/features/care-organizations/service';
import { CARE_ORGANIZATION_SORTS } from '@/features/care-organizations/schema';

export const metadata: Metadata = { title: 'Opdrachtgevers' };

async function ResultTable({
  organizationId,
  searchParams,
}: {
  organizationId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = resolveListParams(searchParams, CARE_ORGANIZATION_SORTS, 'name');
  const page = await listCareOrganizations(organizationId, params);

  if (page.total === 0) {
    return (
      <EmptyState
        title={params.search ? 'Niets gevonden' : 'Nog geen opdrachtgevers'}
        description={
          params.search
            ? `Er is niets dat past bij "${params.search}".`
            : 'Een opdrachtgever is de partij die het vervoer betaalt: een gemeente, een zorginstelling of een school.'
        }
      />
    );
  }

  return (
    <>
      <Table caption="Opdrachtgevers van deze organisatie">
        <Thead>
          <Th>Naam</Th>
          <Th>Plaats</Th>
          <Th>E-mailadres</Th>
          <Th>Telefoon</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          {page.items.map((item) => (
            <Tr key={item.id}>
              <Td>
                <Link
                  href={`/opdrachtgevers/${item.id}` as never}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {item.name}
                </Link>
              </Td>
              <Td className="text-[var(--tp-muted-foreground)]">{item.city ?? '-'}</Td>
              <Td className="text-[var(--tp-muted-foreground)]">
                {item.contact_email ?? '-'}
              </Td>
              <Td className="text-[var(--tp-muted-foreground)]">{item.phone ?? '-'}</Td>
              <Td>
                <Badge variant={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {item.status === 'ACTIVE' ? 'Actief' : 'Inactief'}
                </Badge>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Pagination page={page.page} pageCount={page.pageCount} total={page.total} />
    </>
  );
}

export default async function CareOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('care_organizations.view')) redirect('/dashboard');

  const resolved = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Opdrachtgevers</h1>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            Opdrachtgevers die het vervoer van een cliënt betalen.
          </p>
        </div>

        {membership.permissions.has('care_organizations.manage') ? (
          <Button asChild>
            <Link href="/opdrachtgevers/nieuw">
              <Plus aria-hidden="true" />
              Nieuwe opdrachtgever
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <SearchField label="Zoek op naam, plaats of e-mailadres" />
          <Suspense key={JSON.stringify(resolved)} fallback={<LoadingState />}>
            <ResultTable
              organizationId={membership.organizationId}
              searchParams={resolved}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
