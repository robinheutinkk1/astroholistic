import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { LocationForm } from '@/features/locations/components/location-form';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getLocation } from '@/features/locations/service';
import { deleteLocationAction } from '@/features/locations/actions';

export const metadata: Metadata = { title: 'Locatie' };

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('locations.view')) redirect('/dashboard');

  const { locationId } = await params;
  const record = await getLocation(membership.organizationId, locationId);

  // Not found and not authorised are indistinguishable on purpose: otherwise
  // the response reveals that a record exists in another tenant.
  if (!record) notFound();

  const canManage = membership.permissions.has('locations.manage');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{record.name}</h1>
        {canManage ? (
          <DeleteDialog
            id={record.id}
            title="Locatie verwijderen?"
            description="De locatie is niet meer te kiezen bij nieuwe ritten. Bestaande ritten houden hun adres."
            action={deleteLocationAction}
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
          {!canManage ? (
            <CardDescription>Je hebt geen rechten om dit te wijzigen.</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {canManage ? (
            <LocationForm location={record} />
          ) : (
            <p className="text-sm text-[var(--tp-muted-foreground)]">
              Vraag een beheerder om wijzigingen door te voeren.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
