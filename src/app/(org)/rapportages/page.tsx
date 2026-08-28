import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getOrganizationTimezone } from '@/features/organizations/settings';
import { PeriodPicker } from '@/features/reports/components/period-picker';
import {
  CheckinMethods,
  SummaryCards,
} from '@/features/reports/components/summary-cards';
import {
  PerClientTable,
  PerDayTable,
  PerDriverTable,
} from '@/features/reports/components/report-tables';
import { getReports } from '@/features/reports/service';
import { resolvePeriod } from '@/features/reports/schema';
import { ABSENCE_REASON_LABELS } from '@/features/rides/schema';
import { todayInTimezone } from '@/lib/datetime/timezone';

export const metadata: Metadata = { title: 'Rapportages' };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('reports.view')) redirect('/dashboard');

  const timeZone = await getOrganizationTimezone(membership.organizationId);
  const params = await searchParams;
  const period = resolvePeriod(params, todayInTimezone(timeZone));

  const reports = await getReports(membership.organizationId, period);

  const exportHref = (kind: string) =>
    `/api/rapportages/export?kind=${kind}&from=${period.from}&to=${period.to}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Rapportages</h1>
        <p className="mt-1 max-w-prose text-sm text-[var(--tp-muted-foreground)]">
          Cijfers over de gereden ritten. De periode staat in het adres van deze pagina,
          dus u kunt hem delen — wie hem opent ziet zijn eigen cijfers.
        </p>
      </div>

      <PeriodPicker period={period} />

      <SummaryCards summary={reports.summary} />

      <div className="grid gap-4 lg:grid-cols-2">
        <CheckinMethods summary={reports.summary} />

        <Card>
          <CardHeader>
            <CardTitle>Waarom ritten niet doorgingen</CardTitle>
            <CardDescription>
              Voor de hele organisatie. Bewust niet per cliënt — zie de toelichting
              onderaan.
            </CardDescription>
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

      <ReportSection
        title="Ritten per dag"
        href={exportHref('per-dag')}
        description="Hoeveel ritten er per dag gepland stonden en hoe ze afliepen."
      >
        <PerDayTable rows={reports.perDay} />
      </ReportSection>

      <ReportSection
        title="Per chauffeur"
        href={exportHref('per-chauffeur')}
        description="Volume en punctualiteit per chauffeur. Bedoeld om te zien welke routes structureel krap staan — niet als beoordeling."
      >
        <PerDriverTable rows={reports.perDriver} />
      </ReportSection>

      <ReportSection
        title="Per cliënt"
        href={exportHref('per-client')}
        description="Hoe vaak een cliënt vervoerd is en hoe vaak een rit niet doorging."
      >
        <PerClientTable rows={reports.perClient} />
      </ReportSection>

      <p className="max-w-prose text-xs text-[var(--tp-muted-foreground)]">
        Er is met opzet geen overzicht van afwezigheidsredenen per cliënt. Eén van de
        redenen is &ldquo;ziek&rdquo;, en een telling daarvan per persoon is een
        gezondheidsdossier — precies wat dit product niet bijhoudt. De reden per rit
        blijft zichtbaar bij de rit zelf.
      </p>
    </div>
  );
}

function ReportSection({
  title,
  description,
  href,
  children,
}: {
  title: string;
  description: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {/* A plain anchor, not <Link>: this is a file download, and Next would
            prefetch a route and record an export nobody asked for. */}
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
