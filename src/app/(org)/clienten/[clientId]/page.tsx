import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PrivacyCard } from '@/features/gdpr/components/privacy-card';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ClientForm } from '@/features/clients/components/client-form';
import { PortalAccessCard } from '@/features/portals/components/portal-access-card';
import { DeleteClientButton } from '@/features/clients/components/delete-client-button';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getClient } from '@/features/clients/service';
import { countClientRides } from '@/features/clients/repository';
import { getPortalAccountEmail } from '@/features/portals/grants';

export const metadata: Metadata = { title: 'Cliënt' };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('clients.view')) redirect('/dashboard');

  const { clientId } = await params;
  const client = await getClient(membership.organizationId, clientId);

  // Not found and not authorised look identical from here, which is deliberate:
  // otherwise the response reveals that a client exists in another tenant.
  if (!client) notFound();

  const rideCount = await countClientRides(clientId);
  const canEdit = membership.permissions.has('clients.update');
  const portalEmail = client.user_id ? await getPortalAccountEmail(client.user_id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {client.first_name} {client.last_name}
          </h1>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            {rideCount === 0
              ? 'Nog geen ritten'
              : `${rideCount} ${rideCount === 1 ? 'rit' : 'ritten'} in de administratie`}
          </p>
        </div>

        {membership.permissions.has('clients.delete') ? (
          <DeleteClientButton
            clientId={client.id}
            clientName={`${client.first_name} ${client.last_name}`}
            rideCount={rideCount}
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
          {!canEdit ? (
            <CardDescription>
              Je hebt geen rechten om deze cliënt te wijzigen.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <ClientForm client={client} />
          ) : (
            <dl className="grid max-w-lg gap-3 text-sm sm:grid-cols-2">
              <dt className="text-[var(--tp-muted-foreground)]">Telefoon</dt>
              <dd>{client.phone ?? '—'}</dd>
              <dt className="text-[var(--tp-muted-foreground)]">E-mailadres</dt>
              <dd>{client.email ?? '—'}</dd>
              <dt className="text-[var(--tp-muted-foreground)]">Adres</dt>
              <dd>
                {client.address_line1 ?? '—'}
                {client.postal_code ? `, ${client.postal_code}` : ''}
                {client.city ? ` ${client.city}` : ''}
              </dd>
              <dt className="text-[var(--tp-muted-foreground)]">Referentie</dt>
              <dd>{client.external_reference ?? '—'}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portaaltoegang</CardTitle>
          <CardDescription>
            Geef de cliënt een eigen login om zijn ritten te volgen en een afwezigheid
            door te geven. Dat is geen medewerkersaccount: hij ziet niets van de
            planning en niets van andere cliënten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PortalAccessCard
            kind="CLIENT"
            subjectId={client.id}
            currentEmail={portalEmail}
            canManage={canEdit}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>
            Inzage en verwijdering op verzoek van de cliënt of zijn vertegenwoordiger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrivacyCard
            clientId={client.id}
            anonymizedAt={client.anonymized_at}
            canErase={membership.permissions.has('clients.delete')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
