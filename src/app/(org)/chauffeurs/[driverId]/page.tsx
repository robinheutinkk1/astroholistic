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
import { DriverForm } from '@/features/drivers/components/driver-form';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getDriver } from '@/features/drivers/service';
import { deleteDriverAction } from '@/features/drivers/actions';

export const metadata: Metadata = { title: 'Chauffeur' };

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ driverId: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('drivers.view')) redirect('/dashboard');

  const { driverId } = await params;
  const record = await getDriver(membership.organizationId, driverId);

  // Not found and not authorised are indistinguishable on purpose: otherwise
  // the response reveals that a record exists in another tenant.
  if (!record) notFound();

  const canManage = membership.permissions.has('drivers.manage');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {record.first_name} {record.last_name}
        </h1>
        {canManage ? (
          <DeleteDialog
            id={record.id}
            title="Chauffeur verwijderen?"
            description="De chauffeur verdwijnt uit de lijsten. Gereden ritten blijven bewaard voor de administratie."
            action={deleteDriverAction}
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
            <DriverForm driver={record} />
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
