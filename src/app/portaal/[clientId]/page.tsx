import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { PeriodAbsenceDialog } from '@/features/portals/components/period-absence-dialog';
import { RequestDialog } from '@/features/portals/components/request-dialog';
import { getPortalAccess, getPortalClient } from '@/features/portals/access';
import { getClientRequests, getClientRides } from '@/features/portals/service';
import { RIDE_STATUS_LABELS } from '@/features/rides/status';
import { ABSENCE_REASON_LABELS } from '@/features/rides/schema';

export const metadata: Metadata = { title: 'Vervoer' };

const DATE = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const REQUEST_KIND_LABELS: Record<string, string> = {
  ABSENCE: 'Afmelding',
  TIME_CHANGE: 'Andere tijd',
  DESTINATION_CHANGE: 'Andere bestemming',
  CANCEL: 'Laten vervallen',
  OTHER: 'Overig',
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'In behandeling',
  APPROVED: 'Goedgekeurd',
  REJECTED: 'Afgewezen',
  APPLIED: 'Verwerkt',
};

function RideCard({
  ride,
  clientId,
  clientName,
  canReportAbsence,
  canRequestChanges,
}: {
  ride: Awaited<ReturnType<typeof getClientRides>>[number];
  clientId: string;
  clientName: string;
  canReportAbsence: boolean;
  canRequestChanges: boolean;
}) {
  const finished = ['COMPLETED', 'CANCELLED', 'CLIENT_ABSENT'].includes(ride.status);
  const kinds = [
    ...(canReportAbsence ? (['ABSENCE'] as const) : []),
    ...(canRequestChanges
      ? (['TIME_CHANGE', 'DESTINATION_CHANGE', 'CANCEL', 'OTHER'] as const)
      : []),
  ];

  return (
    <li className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {DATE.format(new Date(`${ride.scheduledDate}T12:00:00Z`))} ·{' '}
          <span className="tabular-nums">{ride.scheduledPickupTime.slice(0, 5)}</span>
        </p>
        <Badge variant={finished ? 'neutral' : 'info'}>
          {RIDE_STATUS_LABELS[ride.status]}
        </Badge>
      </div>

      <p className="mt-1 text-sm text-[var(--tp-muted-foreground)]">
        {ride.pickupName} → {ride.destinationName}
      </p>

      {ride.driverFirstName ? (
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Chauffeur: {ride.driverFirstName}
        </p>
      ) : null}

      {ride.absenceReason ? (
        <p className="mt-1 text-sm text-[var(--tp-warning)]">
          Niet meegereden:{' '}
          {ABSENCE_REASON_LABELS[
            ride.absenceReason as keyof typeof ABSENCE_REASON_LABELS
          ] ?? ride.absenceReason}
        </p>
      ) : null}

      {ride.hasPendingRequest ? (
        <p className="mt-2 text-sm text-[var(--tp-muted-foreground)]">
          Er staat een verzoek open voor deze rit.
        </p>
      ) : !finished && kinds.length > 0 ? (
        <div className="mt-3">
          <RequestDialog
            clientId={clientId}
            rideId={ride.id}
            clientName={clientName}
            rideLabel={`${DATE.format(new Date(`${ride.scheduledDate}T12:00:00Z`))} om ${ride.scheduledPickupTime.slice(0, 5)}`}
            kinds={kinds}
            triggerLabel="Wijziging doorgeven"
          />
        </div>
      ) : null}
    </li>
  );
}

export default async function PortalClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = await getPortalClient(clientId);
  if (!client) notFound();

  const access = await getPortalAccess();
  const [upcoming, past, requests] = await Promise.all([
    getClientRides(client, 'upcoming'),
    getClientRides(client, 'past'),
    getClientRequests(client),
  ]);

  const name = `${client.firstName} ${client.lastName}`;

  return (
    <div className="flex flex-col gap-6">
      {access.clients.length > 1 ? (
        <Link
          href="/portaal"
          className="flex min-h-11 items-center gap-1 text-sm text-[var(--tp-muted-foreground)]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Alle personen
        </Link>
      ) : null}

      <div>
        <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
        {client.relationLabel ? (
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            Jij staat geregistreerd als {client.relationLabel}.
          </p>
        ) : null}
        {client.canReportAbsence ? (
          <div className="mt-3">
            <PeriodAbsenceDialog clientId={client.id} clientName={name} />
          </div>
        ) : null}
        {!client.canReportAbsence && !client.canRequestChanges ? (
          // A care organisation follows the transport but does not speak for
          // the client, so say that instead of showing dead buttons.
          <p className="mt-1 text-sm text-[var(--tp-muted-foreground)]">
            Je kunt het vervoer volgen. Wijzigingen doorgeven loopt via de cliënt of zijn
            contactpersoon.
          </p>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Komende ritten</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            title="Geen ritten gepland"
            description="Er staat niets in de agenda."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                clientId={client.id}
                clientName={name}
                canReportAbsence={client.canReportAbsence}
                canRequestChanges={client.canRequestChanges}
              />
            ))}
          </ul>
        )}
      </section>

      {requests.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Jouw verzoeken</h2>
          <ul className="flex flex-col gap-2">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-[var(--tp-radius)] border border-[var(--tp-border)] bg-[var(--tp-surface)] p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {REQUEST_KIND_LABELS[request.kind] ?? request.kind}
                    {request.periodFrom && request.periodTo
                      ? ` · ${DATE.format(new Date(`${request.periodFrom}T12:00:00Z`))} t/m ${DATE.format(new Date(`${request.periodTo}T12:00:00Z`))}`
                      : request.rideDate
                        ? ` · ${DATE.format(new Date(`${request.rideDate}T12:00:00Z`))}`
                        : ''}
                  </span>
                  <Badge
                    variant={
                      request.status === 'PENDING'
                        ? 'warning'
                        : request.status === 'REJECTED'
                          ? 'danger'
                          : 'success'
                    }
                  >
                    {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                  </Badge>
                </div>
                {request.reviewNote ? (
                  <p className="mt-1 text-[var(--tp-muted-foreground)]">
                    {request.reviewNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Eerdere ritten</h2>
          <ul className="flex flex-col gap-2">
            {past.slice(0, 10).map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                clientId={client.id}
                clientName={name}
                canReportAbsence={false}
                canRequestChanges={false}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
