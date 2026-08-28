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
import { listDrivers } from '@/features/drivers/service';
import { DRIVER_SORTS } from '@/features/drivers/schema';
import { DRIVER_STATUS_LABELS } from '@/features/drivers/schema';

export const metadata: Metadata = { title: 'Chauffeurs' };

async function ResultTable({
  organizationId,
  searchParams,
}: {
  organizationId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = resolveListParams(searchParams, DRIVER_SORTS, 'last_name');
  const page = await listDrivers(organizationId, params);

  if (page.total === 0) {
    return (
      <EmptyState
        title={params.search ? 'Niets gevonden' : 'Nog geen chauffeurs'}
        description={
          params.search
            ? `Er is niets dat past bij "${params.search}".`
            : 'Voeg chauffeurs toe om ritten te kunnen toewijzen.'
        }
      />
    );
  }

  return (
    <>
      <Table caption="Chauffeurs van deze organisatie">
        <Thead>
          <Th>Naam</Th>
          <Th>Medewerkernummer</Th>
          <Th>Telefoon</Th>
          <Th>Status</Th>
          <Th>Account</Th>
        </Thead>
        <Tbody>
          {page.items.map((item) => (
            <Tr key={item.id}>
              <Td>
                <Link
                  href={`/chauffeurs/${item.id}` as never}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {item.last_name}, {item.first_name}
                </Link>
              </Td>
              <Td className="text-[var(--tp-muted-foreground)]">
                {item.employee_number ?? '-'}
              </Td>
              <Td className="text-[var(--tp-muted-foreground)]">{item.phone ?? '-'}</Td>
              <Td>
                <Badge variant={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {DRIVER_STATUS_LABELS[item.status]}
                </Badge>
              </Td>
              <Td>
                {item.user_id ? (
                  <Badge variant="info">Heeft account</Badge>
                ) : (
                  <span className="text-xs text-[var(--tp-muted-foreground)]">
                    Geen account
                  </span>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Pagination page={page.page} pageCount={page.pageCount} total={page.total} />
    </>
  );
}

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('drivers.view')) redirect('/dashboard');

  const resolved = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Chauffeurs</h1>
          <p className="text-sm text-[var(--tp-muted-foreground)]">Wie er rijdt.</p>
        </div>

        {membership.permissions.has('drivers.manage') ? (
          <Button asChild>
            <Link href="/chauffeurs/nieuw">
              <Plus aria-hidden="true" />
              Nieuwe chauffeur
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <SearchField label="Zoek op naam of medewerkernummer" />
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
