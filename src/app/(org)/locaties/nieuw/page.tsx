import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LocationForm } from '@/features/locations/components/location-form';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Nieuwe locatie' };

export default async function NewLocationPage() {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('locations.manage')) redirect('/locaties');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Nieuwe locatie</h1>
      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationForm />
        </CardContent>
      </Card>
    </div>
  );
}
