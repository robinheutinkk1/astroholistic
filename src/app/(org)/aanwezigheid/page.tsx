import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getOrganizationTimezone } from '@/features/organizations/settings';
import { AutoRefresh } from '@/features/presence/components/auto-refresh';
import {
  listArrivals,
  listLocationsWithArrivals,
  type PresenceRow,
} from '@/features/presence/service';
import {
  countPresence,
  PRESENCE_LABELS,
  PRESENCE_ORDER,
  presenceOf,
  type PresenceBucket,
} from '@/features/presence/presence';
import { todayInTimezone } from '@/lib/datetime/timezone';

export const metadata: Metadata = { title: 'Aanwezigheid' };

/**
 * Het antwoord op de vraag van de begeleider: "is Jan er al?"
 *
 * Het bord telt aankomsten op één locatie, vandaag. Vier kleuren die je vanaf
 * de andere kant van de gang leest, met bovenaan wat aandacht vraagt.
 */
export default async function PresencePage({
  searchParams,
}: {
  searchParams: Promise<{ locatie?: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');
  if (!membership.permissions.has('rides.view')) redirect('/dashboard');

  const timeZone = await getOrganizationTimezone(membership.organizationId);
  const today = todayInTimezone(timeZone);
  const { locatie } = await searchParams;

  const locations = await listLocationsWithArrivals(membership.organizationId, today);
  const active = locations.find((location) => location.id === locatie) ?? null;
  const rows = active
    ? await listArrivals(membership.organizationId, active.id, today)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Aanwezigheid</h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Wie er vandaag op een locatie wordt verwacht, en hoe ver ze zijn.
        </p>
      </div>

      {locations.length === 0 ? (
        <EmptyState
          title="Vandaag geen aankomsten"
          description="Er staan geen ritten met een bestemming gepland voor vandaag."
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {locations.map((location) => (
            <Button
              key={location.id}
              asChild
              variant={location.id === active?.id ? 'primary' : 'outline'}
              size="sm"
            >
              <Link href={`/aanwezigheid?locatie=${location.id}` as never}>
                {location.name} ({location.arrivalsToday})
              </Link>
            </Button>
          ))}
        </div>
      )}

      {active ? <Board locationName={active.name} rows={rows} /> : null}

      {!active && locations.length > 0 ? (
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Kies een locatie om het bord te zien.
        </p>
      ) : null}
    </div>
  );
}

const BUCKET_STYLES: Record<PresenceBucket, { dot: string; badge: string }> = {
  PRESENT: { dot: 'bg-green-600', badge: 'success' },
  EN_ROUTE: { dot: 'bg-blue-600', badge: 'info' },
  EXPECTED: { dot: 'bg-amber-500', badge: 'warning' },
  ABSENT: { dot: 'bg-red-600', badge: 'danger' },
  CANCELLED: { dot: 'bg-slate-400', badge: 'neutral' },
};

function Board({
  locationName,
  rows,
}: {
  locationName: string;
  rows: readonly PresenceRow[];
}) {
  const counts = countPresence(rows.map((row) => row.status));

  const byBucket = new Map<PresenceBucket, PresenceRow[]>();
  for (const row of rows) {
    const bucket = presenceOf(row.status);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), row]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2">
        <CardTitle>{locationName}</CardTitle>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          <span className="text-lg font-semibold text-[var(--tp-foreground)] tabular-nums">
            {counts.present}
          </span>{' '}
          van {counts.total} aanwezig
          {counts.absent > 0 ? ` · ${counts.absent} afwezig` : ''}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {PRESENCE_ORDER.map((bucket) => {
          const group = byBucket.get(bucket);
          if (!group || group.length === 0) return null;
          return (
            <section key={bucket}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-full ${BUCKET_STYLES[bucket].dot}`}
                />
                {PRESENCE_LABELS[bucket]} ({group.length})
              </h2>
              <ul className="flex flex-col divide-y divide-[var(--tp-border)] rounded-[var(--tp-radius)] border border-[var(--tp-border)]">
                {group.map((row) => (
                  <li
                    key={row.rideId}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <Link
                      href={`/ritten/${row.rideId}` as never}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.clientName}
                    </Link>
                    <span className="flex items-center gap-3 text-sm text-[var(--tp-muted-foreground)]">
                      {row.pickupTime ? (
                        <span className="tabular-nums">
                          ophalen {row.pickupTime.slice(0, 5)}
                        </span>
                      ) : null}
                      {row.driverName ? <span>{row.driverName}</span> : null}
                      {row.status === 'PROBLEM' ? (
                        <Badge variant="danger">Probleem</Badge>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
