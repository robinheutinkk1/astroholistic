import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getOrganizationTimezone } from '@/features/organizations/settings';
import { ScopePicker } from '@/features/reports/components/scope-picker';
import {
  CheckinMethods,
  SummaryCards,
} from '@/features/reports/components/summary-cards';
import {
  PerClientTable,
  PerDayTable,
  PerDriverTable,
  PerLocationTable,
} from '@/features/reports/components/report-tables';
import { getReports } from '@/features/reports/service';
import { getFilterOptions } from '@/features/reports/filters';
import { hasFilter, resolveScope } from '@/features/reports/schema';
import { ABSENCE_REASON_LABELS } from '@/features/rides/schema';
import { todayInTimezone } from '@/lib/datetime/timezone';

export const metadata: Metadata = { title: 'Rapportages' };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    opdrachtgever?: string;
    locatie?: string;
  }>;
}) {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('reports.view')) redirect('/dashboard');

  const timeZone = await getOrganizationTimezone(membership.organizationId);
  const params = await searchParams;
  const scope = resolveScope(params, todayInTimezone(timeZone));

  const [reports, filters] = await Promise.all([
    getReports(membership.organizationId, scope),
    getFilterOptions(membership.organizationId),
  ]);

  // Het filter gaat mee de export in, zodat het bestand precies bevat wat er op
  // het scherm staat.
  const exportHref = (kind: string) => {
    const query = new URLSearchParams({ kind, from: scope.from, to: scope.to });
    if (scope.careOrganizationId) query.set('opdrachtgever', scope.careOrganizationId);
    if (scope.locationId) query.set('locatie', scope.locationId);
    return `/api/rapportages/export?${query.toString()}`;
  };

  const scopeLabel = (() => {
    if (!hasFilter(scope)) return null;
    const careOrg = filters.careOrganizations.find(
      (option) => option.id === scope.careOrganizationId,
    );
    const location = filters.locations.find((option) => option.id === scope.locationId);
    return [careOrg?.name, location?.name].filter(Boolean).join(', ') || null;
  })();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Rapportages</h1>
        {scopeLabel ? (
          <p className="mt-1 text-sm text-[var(--tp-muted-foreground)]">
            Gefilterd op {scopeLabel}
          </p>
        ) : null}
      </div>

      <ScopePicker
        scope={scope}
        careOrganizations={filters.careOrganizations}
        locations={filters.locations}
      />

      <SummaryCards summary={reports.summary} />

      <div className="grid gap-4 lg:grid-cols-2">
        <CheckinMethods summary={reports.summary} />

        <Card>
          <CardHeader>
            <CardTitle>Waarom ritten niet doorgingen</CardTitle>
          </CardHeader>
          <CardContent>
            {reports.absenceReasons.length === 0 ? (
              <p className="text-sm text-[var(--tp-muted-foreground)]">
                Geen afwezigheden in deze periode.
              </p>
            ) : (
              <dl className="flex flex-col gap-1.5 text-sm">
                {reports.absenceReasons.map((row) => (
                  <div key={row.reason ?? 'onbekend'} className="flex justify-between">
                    <dt>
                      {row.reason
                        ? (ABSENCE_REASON_LABELS[row.reason] ?? row.reason)
                        : 'Niet opgegeven'}
                    </dt>
                    <dd className="tabular-nums">{row.total}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      <ReportSection title="Per locatie" href={exportHref('per-locatie')}>
        <PerLocationTable rows={reports.perLocation} />
      </ReportSection>

      <ReportSection title="Ritten per dag" href={exportHref('per-dag')}>
        <PerDayTable rows={reports.perDay} />
      </ReportSection>

      <ReportSection title="Per chauffeur" href={exportHref('per-chauffeur')}>
        <PerDriverTable rows={reports.perDriver} />
      </ReportSection>

      <ReportSection title="Per cliënt" href={exportHref('per-client')}>
        <PerClientTable rows={reports.perClient} />
      </ReportSection>
    </div>
  );
}

function ReportSection({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle>{title}</CardTitle>
        {/* Een gewone anchor en geen <Link>: dit is een download, en Next zou
            een route prefetchen en een export vastleggen die niemand vroeg. */}
        <Button asChild variant="outline" size="sm">
          <a href={href} download>
            Exporteer CSV
          </a>
        </Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
