import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, Tbody, Th, Thead } from '@/components/ui/data-table';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { StatCard } from '@/features/dashboard/components/stat-card';
import { DayNavigator } from '@/features/planning/components/day-navigator';
import { RideRow } from '@/features/planning/components/ride-row';
import { GenerateButton } from '@/features/ride-templates/components/generate-button';
import { getDayPlan } from '@/features/planning/service';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { todayInTimezone } from '@/lib/datetime/timezone';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Planning' };

async function DayBoard({
  organizationId,
  date,
  canAssign,
}: {
  organizationId: string;
  date: string;
  canAssign: boolean;
}) {
  const plan = await getDayPlan(organizationId, date);

  if (plan.rides.length === 0) {
    return (
      <EmptyState
        title="Geen ritten op deze dag"
        description="Maak een losse rit aan, of laat de terugkerende ritten inplannen."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Ritten" value={plan.counts.total} />
        <StatCard
          label="Zonder chauffeur"
          value={plan.counts.unassigned}
          tone={plan.counts.unassigned > 0 ? 'warning' : 'neutral'}
        />
        <StatCard label="Geannuleerd" value={plan.counts.cancelled} />
      </div>

      <Table caption={`Ritten op ${date}`}>
        <Thead>
          <Th>Tijd</Th>
          <Th>Cliënt</Th>
          <Th>Van en naar</Th>
          <Th>Chauffeur en voertuig</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          {plan.rides.map((ride) => (
            <RideRow
              key={ride.id}
              ride={ride}
              drivers={plan.drivers}
              vehicles={plan.vehicles}
              conflicts={plan.conflicts.get(ride.id) ?? []}
              canAssign={canAssign}
            />
          ))}
        </Tbody>
      </Table>
    </div>
  );
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('planning.view')) redirect('/dashboard');

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('timezone')
    .eq('organization_id', membership.organizationId)
    .maybeSingle();

  const timeZone = settings?.timezone ?? 'Europe/Amsterdam';
  const today = todayInTimezone(timeZone);
  const { datum } = await searchParams;

  // A malformed date in the URL shows today rather than an error page.
  const date = datum && /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : today;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Planning</h1>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            De ritten van één dag, met chauffeur en voertuig.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {membership.permissions.has('ride_templates.manage') ? (
            <GenerateButton />
          ) : null}
          {membership.permissions.has('rides.create') ? (
            <Button asChild>
              <Link href="/ritten/nieuw">
                <Plus aria-hidden="true" />
                Losse rit
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <DayNavigator date={date} today={today} />

      <Card>
        <CardContent className="pt-5">
          <Suspense key={date} fallback={<LoadingState label="Planning laden…" />}>
            <DayBoard
              organizationId={membership.organizationId}
              date={date}
              canAssign={membership.permissions.has('rides.assign_driver')}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
