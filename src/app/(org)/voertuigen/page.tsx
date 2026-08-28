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
import { listVehicles } from '@/features/vehicles/service';
import { VEHICLE_SORTS } from '@/features/vehicles/schema';
import { VEHICLE_STATUS_LABELS } from '@/features/vehicles/schema';

export const metadata: Metadata = { title: 'Voertuigen' };

async function ResultTable({
  organizationId,
  searchParams,
}: {
  organizationId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = resolveListParams(searchParams, VEHICLE_SORTS, 'license_plate');
  const page = await listVehicles(organizationId, params);

  if (page.total === 0) {
    return (
      <EmptyState
        title={params.search ? 'Niets gevonden' : 'Nog geen voertuigen'}
        description={
          params.search
            ? `Er is niets dat past bij "${params.search}".`
            : 'Voeg voertuigen toe zodat het systeem capaciteit kan controleren.'
        }
      />
    );
  }

  return (
    <>
      <Table caption="Voertuigen van deze organisatie">
        <Thead>
          <Th>Kenteken</Th>
          <Th>Merk en model</Th>
          <Th>Zitplaatsen</Th>
          <Th>Rolstoel</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          {page.items.map((item) => (
            <Tr key={item.id}>
              <Td>
                <Link
                  href={`/voertuigen/${item.id}` as never}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {item.license_plate}
                </Link>
              </Td>
              <Td className="text-[var(--tp-muted-foreground)]">
                {[item.make, item.model].filter(Boolean).join(' ') || '-'}
              </Td>
              <Td>{item.seats}</Td>
              <Td>
                {item.wheelchair_positions > 0 ? (
                  <Badge variant="info">{item.wheelchair_positions} plaats(en)</Badge>
                ) : (
                  <span className="text-xs text-[var(--tp-muted-foreground)]">Nee</span>
                )}
              </Td>
              <Td>
                <Badge variant={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {VEHICLE_STATUS_LABELS[item.status]}
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

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('vehicles.view')) redirect('/dashboard');

  const resolved = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Voertuigen</h1>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            De bussen in de vloot.
          </p>
        </div>

        {membership.permissions.has('vehicles.manage') ? (
          <Button asChild>
            <Link href="/voertuigen/nieuw">
              <Plus aria-hidden="true" />
              Nieuw voertuig
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <SearchField label="Zoek op kenteken, merk of model" />
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
