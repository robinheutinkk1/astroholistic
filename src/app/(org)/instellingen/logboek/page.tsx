import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getOrganizationTimezone } from '@/features/organizations/settings';
import { listAuditLog } from '@/features/audit/service';
import { auditActionLabel } from '@/features/audit/labels';
import { isLocalDate } from '@/lib/datetime/timezone';

export const metadata: Metadata = { title: 'Logboek' };

/**
 * Wie deed wat, en wanneer.
 *
 * Voor de organisatie zelf, maar net zo goed voor het gesprek met een
 * zorginstelling of een toezichthouder: "Robin heeft cliënt X ingecheckt om
 * 08:14" stond al maanden in de database en was tot dit scherm alleen met
 * SQL te lezen.
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; van?: string; tot?: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('audit.view')) redirect('/instellingen');

  const params = await searchParams;
  // Onleesbare filters vallen weg in plaats van een fout te geven: dit is een
  // querystring, en een bladwijzer van vorig kwartaal hoort gewoon te openen.
  const from = params.van && isLocalDate(params.van) ? params.van : null;
  const to = params.tot && isLocalDate(params.tot) ? params.tot : null;
  const page = Math.max(1, Number.parseInt(params.pagina ?? '1', 10) || 1);

  const [timeZone, log] = await Promise.all([
    getOrganizationTimezone(membership.organizationId),
    listAuditLog(membership.organizationId, { page, from, to }),
  ]);

  const timestamp = new Intl.DateTimeFormat('nl-NL', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (from) query.set('van', from);
    if (to) query.set('tot', to);
    if (target > 1) query.set('pagina', String(target));
    const suffix = query.toString();
    return `/instellingen/logboek${suffix ? `?${suffix}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Logboek</h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Wie deed wat, en wanneer. Regels worden geschreven door het systeem en zijn door
          niemand aan te passen of te verwijderen.
        </p>
      </div>

      <form
        method="get"
        action="/instellingen/logboek"
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Van
          <input
            type="date"
            name="van"
            defaultValue={from ?? ''}
            className="h-10 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tot en met
          <input
            type="date"
            name="tot"
            defaultValue={to ?? ''}
            className="h-10 rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] px-3 text-sm"
          />
        </label>
        <Button type="submit" variant="outline">
          Toon
        </Button>
      </form>

      <Card>
        <CardContent className="pt-5">
          {log.rows.length === 0 ? (
            <EmptyState
              title="Geen regels in deze periode"
              description="Kies een andere periode, of haal het filter weg."
            />
          ) : (
            <>
              <Table caption="Logboek van deze organisatie">
                <Thead>
                  <Th>Wanneer</Th>
                  <Th>Wie</Th>
                  <Th>Wat</Th>
                </Thead>
                <Tbody>
                  {log.rows.map((row) => (
                    <Tr key={row.id}>
                      <Td className="whitespace-nowrap text-[var(--tp-muted-foreground)] tabular-nums">
                        {timestamp.format(new Date(row.createdAt))}
                      </Td>
                      <Td>
                        {row.actorName ?? (
                          <span className="text-[var(--tp-muted-foreground)]">
                            Systeem
                          </span>
                        )}
                      </Td>
                      <Td>{auditActionLabel(row.action)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--tp-muted-foreground)] tabular-nums">
                  Pagina {log.page} van {log.pageCount} · {log.total} regels
                </span>
                <span className="flex gap-2">
                  {log.page > 1 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={pageHref(log.page - 1) as never}>Nieuwer</Link>
                    </Button>
                  ) : null}
                  {log.page < log.pageCount ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={pageHref(log.page + 1) as never}>Ouder</Link>
                    </Button>
                  ) : null}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
