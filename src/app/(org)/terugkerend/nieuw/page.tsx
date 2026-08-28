import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TemplateForm } from '@/features/ride-templates/components/template-form';
import { loadPickerOptions } from '@/features/rides/pickers';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Nieuwe terugkerende rit' };

export default async function NewTemplatePage() {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('ride_templates.manage')) redirect('/terugkerend');

  const options = await loadPickerOptions(membership.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Nieuwe terugkerende rit</h1>
      <Card>
        <CardHeader>
          <CardTitle>De vaste afspraak</CardTitle>
          <CardDescription>
            Zodra je opslaat plant het systeem de komende weken meteen in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateForm {...options} />
        </CardContent>
      </Card>
    </div>
  );
}
