import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        </CardHeader>
        <CardContent>
          <ContactForm />
        </CardContent>
      </Card>
    </div>
  );
}
