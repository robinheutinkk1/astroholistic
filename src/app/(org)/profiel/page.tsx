import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProfileForm } from '@/features/auth/components/profile-form';
import { getCurrentUser } from '@/features/rbac/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Mijn profiel' };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Mijn profiel</h1>

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
          <CardDescription>
            Deze naam zien collega&apos;s bij ritten die jij aanpast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            fullName={profile?.full_name ?? ''}
            phone={profile?.phone ?? ''}
            email={user.email}
          />
        </CardContent>
      </Card>
    </div>
  );
}
