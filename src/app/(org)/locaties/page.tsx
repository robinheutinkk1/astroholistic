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
import { listLocations } from '@/features/locations/service';
import { LOCATION_SORTS } from '@/features/locations/schema';
import { LOCATION_KIND_LABELS } from '@/features/locations/schema';

export const metadata: Metadata = { title: 'Locaties' };

async function ResultTable({
  organizationId,
  searchParams,
}: {
  organizationId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = resolveListParams(searchParams, LOCATION_SORTS, 'name');
  const page = await listLocations(organizationId, params);

  if (page.total === 0) {
    return (
      <EmptyState
        title={params.search ? 'Niets gevonden' : 'Nog geen locaties'}
        description={
          params.search
            ? `Er is niets dat past bij "${params.search}".`
            : 'Locaties zijn herbruikbaar: een dagbesteding voer je een keer in.'
        }
      />
    );
  }

  return (
    <>
      <Table caption="Locaties van deze organisatie">
        <Thead>
          <Th>Naam</Th>
          <Th>Soort</Th>
          <Th>Adres</Th>
          <Th>Plaats</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          {page.items.map((item) => (
            <Tr key={item.id}>
              <Td>
                <Link
                  href={`/locaties/${item.id}` as never}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {item.name}
                </Link>
              </Td>
              <Td className="text-[var(--tp-muted-foreground)]">
                {LOCATION_KIND_LABELS[item.kind]}
              </Td>
              <Td className="text-[var(--tp-muted-foreground)]">
                {item.address_line1 ?? '-'}
              </Td>
              <Td className="text-[var(--tp-muted-foreground)]">{item.city ?? '-'}</Td>
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

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('locations.view')) redirect('/dashboard');

  const resolved = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Locaties</h1>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            Adressen waar wordt opgehaald en afgeleverd.
          </p>
        </div>

        {membership.permissions.has('locations.manage') ? (
          <Button asChild>
            <Link href="/locaties/nieuw">
              <Plus aria-hidden="true" />
              Nieuwe locatie
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <SearchField label="Zoek op naam, adres of plaats" />
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
