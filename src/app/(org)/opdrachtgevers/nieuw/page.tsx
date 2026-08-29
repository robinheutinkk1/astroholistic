import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CareOrganizationForm } from '@/features/care-organizations/components/care-organization-form';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Nieuwe opdrachtgever' };

export default async function NewCareOrganizationPage() {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('care_organizations.manage')) redirect('/dashboard');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Nieuwe opdrachtgever</h1>

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <CareOrganizationForm />
        </CardContent>
      </Card>
    </div>
  );
}
