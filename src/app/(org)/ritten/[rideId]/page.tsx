import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RideForm } from '@/features/rides/components/ride-form';
import { RideStatusBadge } from '@/features/rides/components/ride-status-badge';
import { loadPickerOptions } from '@/features/rides/pickers';
import { getRide, getRideEvents } from '@/features/rides/service';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Rit' };

const TIME = new Intl.DateTimeFormat('nl-NL', {
  hour: '2-digit',
  minute: '2-digit',
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Amsterdam',
});

const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Rit aangemaakt',
  DRIVER_ASSIGNED: 'Chauffeur toegewezen',
  DRIVER_UNASSIGNED: 'Chauffeur losgekoppeld',
  DRIVER_EN_ROUTE: 'Chauffeur onderweg',
  DRIVER_ARRIVED: 'Chauffeur aangekomen',
  CLIENT_CHECKED_IN: 'Cliënt ingecheckt',
  CLIENT_CHECKED_OUT: 'Cliënt uitgecheckt',
  TRIP_STARTED: 'Rit gestart',
  ARRIVED: 'Op bestemming',
  COMPLETED: 'Rit afgerond',
  CLIENT_ABSENT: 'Cliënt afwezig',
  CANCELLED: 'Rit geannuleerd',
  PROBLEM_REPORTED: 'Probleem gemeld',
  NOTE_ADDED: 'Notitie toegevoegd',
  RESCHEDULED: 'Rit gewijzigd',
  VEHICLE_ASSIGNED: 'Voertuig toegewezen',
};

export default async function RideDetailPage({
  params,
}: {
  params: Promise<{ rideId: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('rides.view')) redirect('/dashboard');

  const { rideId } = await params;
  const ride = await getRide(membership.organizationId, rideId);
  if (!ride) notFound();

  const [events, options] = await Promise.all([
    getRideEvents(membership.organizationId, rideId),
    loadPickerOptions(membership.organizationId),
  ]);

  const canEdit = membership.permissions.has('rides.update');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Rit op {ride.scheduled_date} om {ride.scheduled_pickup_time.slice(0, 5)}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <RideStatusBadge status={ride.status} />
            {ride.ride_template_id ? (
              <Badge variant="outline">Uit terugkerende afspraak</Badge>
            ) : (
              <Badge variant="outline">Losse rit</Badge>
            )}
            {ride.is_modified ? <Badge variant="warning">Afwijkend</Badge> : null}
          </div>
        </div>
      </div>

      {ride.is_modified ? (
        <p className="rounded-[var(--tp-radius)] bg-orange-50 px-3 py-2 text-sm text-orange-900">
          Deze rit is handmatig aangepast. Wijzigingen aan de terugkerende afspraak werken
          hier niet meer in door.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ritgegevens</CardTitle>
          {!canEdit ? (
            <CardDescription>
              Je hebt geen rechten om deze rit te wijzigen.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <RideForm ride={ride} {...options} defaultDate={ride.scheduled_date} />
          ) : (
            <p className="text-sm text-[var(--tp-muted-foreground)]">
              Vraag een planner om wijzigingen door te voeren.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verloop van de rit</CardTitle>
          <CardDescription>
            Deze regels kunnen niet worden gewijzigd of verwijderd — het is de vastlegging
            van wat er gebeurd is.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-[var(--tp-muted-foreground)]">
              Nog geen gebeurtenissen.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span className="w-28 shrink-0 text-[var(--tp-muted-foreground)] tabular-nums">
                    {TIME.format(new Date(event.occurred_at))}
                  </span>
                  <span>{EVENT_LABELS[event.event_type] ?? event.event_type}</span>
                  {event.source !== 'MANUAL' ? (
                    <Badge variant="outline">{event.source}</Badge>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
