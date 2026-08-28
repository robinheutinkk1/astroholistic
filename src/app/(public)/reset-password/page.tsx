import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { getCurrentUser } from '@/features/rbac/session';

export const metadata: Metadata = { title: 'Nieuw wachtwoord' };

/**
 * Reachable only with a valid recovery session, which the /auth/callback route
 * establishes from the e-mailed link. Without it there is nothing to update.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/forgot-password?expired=1');

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-lg">
          Nieuw wachtwoord instellen
        </CardTitle>
        <CardDescription>
          Kies een wachtwoord dat je nergens anders gebruikt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
