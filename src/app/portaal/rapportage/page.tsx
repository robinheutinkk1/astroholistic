import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { getPortalAccess } from '@/features/portals/access';
import { PeriodPicker } from '@/features/reports/components/period-picker';
import { resolvePeriod } from '@/features/reports/schema';
import { getPortalClientSummary } from '@/features/reports/service';
import { DEFAULT_TIMEZONE } from '@/features/organizations/settings';
import { todayInTimezone } from '@/lib/datetime/timezone';

export const metadata: Metadata = { title: 'Overzicht' };
export const dynamic = 'force-dynamic';

/**
 * The figures a care organisation gets about the clients it funds
 * (docs/ROLES_AND_PERMISSIONS.md §6).
 *
 * Counts only: how often transport was arranged, how often it went ahead, how
 * often it did not. No reasons and no dates per person — an opdrachtgever
 * funds the transport, they are not entitled to a picture of someone's week.
 *
 * The scoping is not done here. `report_portal_client_summary()` filters on
 * `app.portal_client_ids()`, the same helper the rest of the portal uses, so a
 * client whose funding period has ended vanishes from this page in the same
 * statement that removes them from the list.
 */
export default async function PortalReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const access = await getPortalAccess();
  if (access.clients.length === 0) redirect('/portaal');

  const params = await searchParams;
  // A portal viewer can reach clients at more than one transport company, so
  // there is no single organisation whose timezone applies. The platform
  // default is the honest choice here, and it only affects which day counts as
  // "today" in the default period.
  const period = resolvePeriod(params, todayInTimezone(DEFAULT_TIMEZONE));

  const rows = await getPortalClientSummary(period);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Overzicht</h1>
        <p className="mt-1 text-sm text-[var(--tp-muted-foreground)]">
          Aantallen per persoon over de gekozen periode.
        </p>
      </div>

      <PeriodPicker period={period} />

      {rows.length === 0 ? (
        <EmptyState
          title="Geen ritten in deze periode"
          description="Kies een andere periode om cijfers te zien."
        />
      ) : (
        <Table caption="Ritten per persoon">
          <Thead>
            <Th>Naam</Th>
            <Th className="text-right">Ritten</Th>
            <Th className="text-right">Gereden</Th>
            <Th className="text-right">Niet doorgegaan</Th>
          </Thead>
          <Tbody>
            {rows.map((row) => (
              <Tr key={row.clientId ?? 'onbekend'}>
                <Td>{row.clientName ?? 'Onbekend'}</Td>
                <Td className="text-right tabular-nums">{row.total}</Td>
                <Td className="text-right tabular-nums">{row.completed}</Td>
                <Td className="text-right tabular-nums">{row.absent + row.cancelled}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Link href="/portaal" className="text-sm underline">
        Terug naar het overzicht
      </Link>
    </div>
  );
}
