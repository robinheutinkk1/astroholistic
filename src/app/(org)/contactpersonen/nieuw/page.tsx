import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ContactForm } from '@/features/contacts/components/contact-form';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Nieuwe contactpersoon' };

export default async function NewContactPage() {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('contacts.manage')) redirect('/dashboard');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Nieuwe contactpersoon</h1>

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
          <CardDescription>
            Na het opslaan koppel je deze persoon aan een of meer cliënten, en bepaal je
            per cliënt wat hij mag.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContactForm />
        </CardContent>
      </Card>
    </div>
  );
}
