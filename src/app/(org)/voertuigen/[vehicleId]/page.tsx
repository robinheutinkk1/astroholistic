import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { VehicleForm } from '@/features/vehicles/components/vehicle-form';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getVehicle } from '@/features/vehicles/service';
import { deleteVehicleAction } from '@/features/vehicles/actions';

export const metadata: Metadata = { title: 'Voertuig' };

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('vehicles.view')) redirect('/dashboard');

  const { vehicleId } = await params;
  const record = await getVehicle(membership.organizationId, vehicleId);

  // Not found and not authorised are indistinguishable on purpose: otherwise
  // the response reveals that a record exists in another tenant.
  if (!record) notFound();

  const canManage = membership.permissions.has('vehicles.manage');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{record.license_plate}</h1>
        {canManage ? (
          <DeleteDialog
            id={record.id}
            title="Voertuig verwijderen?"
            description="Het voertuig verdwijnt uit de lijsten. Gereden ritten blijven bewaard."
            action={deleteVehicleAction}
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <VehicleForm vehicle={record} />
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
