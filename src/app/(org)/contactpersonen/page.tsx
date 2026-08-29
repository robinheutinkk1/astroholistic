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
import { listContacts } from '@/features/contacts/service';
import { CONTACT_SORTS } from '@/features/contacts/schema';

export const metadata: Metadata = { title: 'Contactpersonen' };

async function ResultTable({
  organizationId,
  searchParams,
}: {
  organizationId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = resolveListParams(searchParams, CONTACT_SORTS, 'last_name');
  const page = await listContacts(organizationId, params);

  if (page.total === 0) {
    return (
      <EmptyState
        title={params.search ? 'Niets gevonden' : 'Nog geen contactpersonen'}
        description={
          params.search
            ? `Er is niets dat past bij "${params.search}".`
            : 'Een contactpersoon is een ouder, mentor of begeleider. Je koppelt hem daarna aan een of meer cliënten.'
        }
      />
    );
  }

  return (
    <>
      <Table caption="Contactpersonen van deze organisatie">
        <Thead>
          <Th>Naam</Th>
          <Th>Telefoon</Th>
          <Th>E-mailadres</Th>
          <Th>Portaal</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          {page.items.map((item) => (
            <Tr key={item.id}>
              <Td>
                <Link
                  href={`/contactpersonen/${item.id}` as never}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {item.first_name} {item.last_name}
                </Link>
              </Td>
              <Td className="text-[var(--tp-muted-foreground)]">{item.phone ?? '-'}</Td>
              <Td className="text-[var(--tp-muted-foreground)]">{item.email ?? '-'}</Td>
              <Td>
                {item.user_id ? (
                  <Badge variant="success">Toegang</Badge>
                ) : (
                  <span className="text-[var(--tp-muted-foreground)]">-</span>
                )}
              </Td>
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

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('contacts.view')) redirect('/dashboard');

  const resolved = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Contactpersonen</h1>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            Ouders, mentoren en begeleiders die voor een cliënt regelen.
          </p>
        </div>

        {membership.permissions.has('contacts.manage') ? (
          <Button asChild>
            <Link href="/contactpersonen/nieuw">
              <Plus aria-hidden="true" />
              Nieuwe contactpersoon
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <SearchField label="Zoek op naam, telefoon of e-mailadres" />
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
