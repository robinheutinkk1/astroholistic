import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignInForm } from '@/features/auth/components/sign-in-form';
import { getCurrentUser } from '@/features/rbac/session';

export const metadata: Metadata = { title: 'Inloggen' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const { next } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-lg">
          Inloggen
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SignInForm redirectTo={next} />
      </CardContent>
    </Card>
  );
}
