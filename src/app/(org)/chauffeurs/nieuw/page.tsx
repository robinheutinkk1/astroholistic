import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DriverForm } from '@/features/drivers/components/driver-form';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Nieuwe chauffeur' };

export default async function NewDriverPage() {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('drivers.manage')) redirect('/chauffeurs');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Nieuwe chauffeur</h1>
      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <DriverForm />
        </CardContent>
      </Card>
    </div>
  );
}
