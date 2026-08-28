import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoadingState } from '@/components/ui/states';
import { LiveCounters } from '@/features/dashboard/components/live-counters';
import { StatCard } from '@/features/dashboard/components/stat-card';
import { getFleetCounts, getTodayCounts } from '@/features/dashboard/service';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getCurrentUser } from '@/features/rbac/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dashboard' };

async function TodayFigures({
  organizationId,
  timeZone,
}: {
  organizationId: string;
  timeZone: string;
}) {
  const counts = await getTodayCounts(organizationId, timeZone);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Geplande ritten" value={counts.total} />
      <StatCard label="Afgerond" value={counts.completed} tone="success" />
      <StatCard label="Onderweg" value={counts.enRoute} tone="info" />
      <StatCard label="Wacht nog" value={counts.waiting} />
      {counts.problems > 0 ? (
        <StatCard label="Probleem" value={counts.problems} tone="danger" />
      ) : null}
      {counts.absent > 0 ? (
        <StatCard label="Cliënt afwezig" value={counts.absent} tone="warning" />
      ) : null}
      {counts.unassigned > 0 ? (
        <StatCard
          label="Zonder chauffeur"
          value={counts.unassigned}
          tone="warning"
          hint="Deze ritten hebben nog niemand toegewezen."
        />
      ) : null}
    </div>
  );
}

async function FleetFigures({ organizationId }: { organizationId: string }) {
  const counts = await getFleetCounts(organizationId);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Actieve cliënten" value={counts.clients} />
      <StatCard label="Actieve chauffeurs" value={counts.drivers} />
      <StatCard label="Beschikbare voertuigen" value={counts.vehicles} />
    </div>
  );
}

export default async function DashboardPage() {
  const [user, membership] = await Promise.all([getCurrentUser(), getActiveMembership()]);
  if (!user || !membership) redirect('/login');

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('timezone')
    .eq('organization_id', membership.organizationId)
    .maybeSingle();

  const timeZone = settings?.timezone ?? 'Europe/Amsterdam';
  const canSeeRides = membership.permissions.has('rides.view');
  const firstName = user.fullName?.split(' ')[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {firstName ? `Welkom, ${firstName}` : 'Welkom'}
        </h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          {membership.organizationName}
        </p>
      </div>

      {canSeeRides ? (
        <section className="flex flex-col gap-3">
          {/* Renders nothing; subscribes so the figures refresh themselves. */}
          <LiveCounters organizationId={membership.organizationId} />
          <h2 className="text-sm font-medium">Vandaag</h2>
          {/* Suspense per section: the fleet counts render immediately even if
              the ride counts are slower, instead of the page waiting for both. */}
          <Suspense fallback={<LoadingState label="Ritten van vandaag laden…" />}>
            <TodayFigures
              organizationId={membership.organizationId}
              timeZone={timeZone}
            />
          </Suspense>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Organisatie</h2>
        <Suspense fallback={<LoadingState label="Gegevens laden…" />}>
          <FleetFigures organizationId={membership.organizationId} />
        </Suspense>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Wat er nog niet is</CardTitle>
          <CardDescription>
            Ritplanning en dispatch volgen in de volgende fase. Tot die tijd zijn de
            cijfers hierboven gebaseerd op ritten die al in de database staan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Link href="/clienten" className="underline underline-offset-4">
            Cliënten beheren
          </Link>
          <Link href="/chauffeurs" className="underline underline-offset-4">
            Chauffeurs
          </Link>
          <Link href="/voertuigen" className="underline underline-offset-4">
            Voertuigen
          </Link>
          <Link href="/locaties" className="underline underline-offset-4">
            Locaties
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
