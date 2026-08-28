import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/data-table';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { Pagination, SearchField } from '@/components/ui/list-controls';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { listClients } from '@/features/clients/service';
import { CLIENT_SORTS } from '@/features/clients/schema';
import { resolveListParams } from '@/lib/pagination';

export const metadata: Metadata = { title: 'Cliënten' };

async function ClientTable({
  organizationId,
  searchParams,
}: {
  organizationId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = resolveListParams(searchParams, CLIENT_SORTS, 'last_name');
  const page = await listClients(organizationId, params);

  if (page.total === 0) {
    return (
      <EmptyState
        title={params.search ? 'Geen cliënten gevonden' : 'Nog geen cliënten'}
        description={
          params.search
            ? `Er is niemand die past bij "${params.search}".`
            : 'Voeg je eerste cliënt toe om te kunnen plannen.'
        }
      />
    );
  }

  return (
    <>
      <Table caption="Cliënten van deze organisatie">
        <Thead>
          <Th>Naam</Th>
          <Th>Plaats</Th>
          <Th>Telefoon</Th>
          <Th>Referentie</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          {page.items.map((client) => (
            <Tr key={client.id}>
              <Td>
                <Link
                  href={`/clienten/${client.id}` as never}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {client.last_name}, {client.first_name}
                </Link>
              </Td>
              <Td className="text-[var(--tp-muted-foreground)]">{client.city ?? '—'}</Td>
              <Td className="text-[var(--tp-muted-foreground)]">{client.phone ?? '—'}</Td>
              <Td className="text-[var(--tp-muted-foreground)]">
                {client.external_reference ?? '—'}
              </Td>
              <Td>
                <Badge variant={client.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {client.status === 'ACTIVE' ? 'Actief' : 'Inactief'}
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

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('clients.view')) redirect('/dashboard');

  const resolved = await searchParams;
  // Keyed on the query string so Suspense shows the skeleton again when the
  // planner types a new search, instead of freezing the previous results.
  const suspenseKey = JSON.stringify(resolved);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cliënten</h1>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            De mensen die jullie vervoeren.
          </p>
        </div>

        {membership.permissions.has('clients.create') ? (
          <Button asChild>
            <Link href="/clienten/nieuw">
              <Plus aria-hidden="true" />
              Nieuwe cliënt
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <SearchField label="Zoek op naam, plaats of referentie" />
          <Suspense key={suspenseKey} fallback={<LoadingState label="Cliënten laden…" />}>
            <ClientTable
              organizationId={membership.organizationId}
              searchParams={resolved}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
