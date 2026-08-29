import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LocationForm } from '@/features/locations/components/location-form';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { listCareOrganizationOptions } from '@/features/care-organizations/options';

export const metadata: Metadata = { title: 'Nieuwe locatie' };

export default async function NewLocationPage() {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('locations.manage')) redirect('/locaties');

  // Zonder leesrecht op opdrachtgevers blijft het veld weg in plaats van leeg.
  const careOrganizations = membership.permissions.has('care_organizations.view')
    ? await listCareOrganizationOptions(membership.organizationId)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Nieuwe locatie</h1>
      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationForm careOrganizations={careOrganizations} />
        </CardContent>
      </Card>
    </div>
  );
}
