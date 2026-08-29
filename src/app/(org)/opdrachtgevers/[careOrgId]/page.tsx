import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { EmptyState } from '@/components/ui/states';
import { CareOrganizationForm } from '@/features/care-organizations/components/care-organization-form';
import { CareOrgPortalUsers } from '@/features/portals/components/care-org-portal-users';
import { getActiveMembership } from '@/features/organizations/active-organization';
import {
  getCareOrganization,
  listFundedClients,
  listLocationsForCareOrganization,
} from '@/features/care-organizations/service';
import { deleteCareOrganizationAction } from '@/features/care-organizations/actions';
import { listCareOrgPortalUsers } from '@/features/portals/grants';
import { todayInTimezone } from '@/lib/datetime/timezone';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Opdrachtgever' };

export default async function CareOrganizationDetailPage({
  params,
}: {
  params: Promise<{ careOrgId: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('care_organizations.view')) redirect('/dashboard');

  const { careOrgId } = await params;
  const careOrganization = await getCareOrganization(
    membership.organizationId,
    careOrgId,
  );

  // Niet gevonden en geen toegang zijn met opzet niet te onderscheiden.
  if (!careOrganization) notFound();

  const canManage = membership.permissions.has('care_organizations.manage');
  const [clients, portalUsers, locations] = await Promise.all([
    listFundedClients(membership.organizationId, careOrgId),
    listCareOrgPortalUsers(membership.organizationId, careOrgId),
    membership.permissions.has('locations.view')
      ? listLocationsForCareOrganization(membership.organizationId, careOrgId)
      : Promise.resolve([]),
  ]);

  // De datum in de tijdzone van de organisatie, niet die van de server: een
  // indicatie die "vandaag" afloopt hoort dat in Amsterdam te doen.
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('timezone')
    .eq('organization_id', membership.organizationId)
    .maybeSingle();
  const today = todayInTimezone(settings?.timezone ?? 'Europe/Amsterdam');
  const current = clients.filter(
    (client) =>
      client.validFrom <= today && (client.validTo === null || client.validTo >= today),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {careOrganization.name}
          </h1>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            {current.length === 0
              ? 'Geen lopende cliënten'
              : `${current.length} ${current.length === 1 ? 'cliënt' : 'cliënten'} lopend`}
          </p>
        </div>

        {canManage ? (
          <DeleteDialog
            id={careOrganization.id}
            title="Opdrachtgever verwijderen?"
            description="De koppelingen met cliënten verdwijnen en iedereen die namens deze organisatie meekeek, verliest per direct zijn toegang."
            action={deleteCareOrganizationAction}
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <CareOrganizationForm careOrganization={careOrganization} />
          ) : (
            <dl className="grid max-w-lg gap-3 text-sm sm:grid-cols-2">
              <dt className="text-[var(--tp-muted-foreground)]">E-mailadres</dt>
              <dd>{careOrganization.contact_email ?? '-'}</dd>
              <dt className="text-[var(--tp-muted-foreground)]">Telefoon</dt>
              <dd>{careOrganization.phone ?? '-'}</dd>
              <dt className="text-[var(--tp-muted-foreground)]">Plaats</dt>
              <dd>{careOrganization.city ?? '-'}</dd>
              <dt className="text-[var(--tp-muted-foreground)]">Referentie</dt>
              <dd>{careOrganization.external_reference ?? '-'}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      {membership.permissions.has('locations.view') ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <CardTitle>Vestigingen</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={`/rapportages?opdrachtgever=${careOrganization.id}` as never}>
                Rapportage
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <EmptyState
                title="Nog geen vestigingen"
                description="Koppel een locatie aan deze opdrachtgever op de pagina van die locatie."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {locations.map((location) => (
                  <li
                    key={location.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--tp-radius)] border border-[var(--tp-border)] p-3"
                  >
                    <div>
                      <Link
                        href={`/locaties/${location.id}` as never}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {location.name}
                      </Link>
                      <p className="text-xs text-[var(--tp-muted-foreground)]">
                        {location.city ?? 'Geen plaats ingevuld'}
                      </p>
                    </div>
                    <Badge variant={location.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {location.status === 'ACTIVE' ? 'Actief' : 'Inactief'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Cliënten</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <EmptyState
              title="Nog geen cliënten"
              description="Ga naar een cliënt en koppel deze zorgorganisatie daar als opdrachtgever."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {clients.map((client) => {
                const running =
                  client.validFrom <= today &&
                  (client.validTo === null || client.validTo >= today);
                return (
                  <li
                    key={`${client.clientId}-${client.validFrom}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--tp-radius)] border border-[var(--tp-border)] p-3"
                  >
                    <div>
                      <Link
                        href={`/clienten/${client.clientId}` as never}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {client.firstName} {client.lastName}
                      </Link>
                      <p className="text-xs text-[var(--tp-muted-foreground)]">
                        Vanaf {client.validFrom}
                        {client.validTo
                          ? ` tot en met ${client.validTo}`
                          : ', geen einddatum'}
                      </p>
                    </div>
                    <Badge variant={running ? 'success' : 'neutral'}>
                      {running ? 'Loopt' : 'Afgelopen'}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wie mag meekijken</CardTitle>
        </CardHeader>
        <CardContent>
          <CareOrgPortalUsers
            careOrganizationId={careOrganization.id}
            users={portalUsers}
            canManage={canManage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
