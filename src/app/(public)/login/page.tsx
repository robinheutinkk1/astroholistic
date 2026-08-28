import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Inloggen' };

/**
 * Placeholder. The real sign-in form, including password reset and e-mail
 * verification, is built in Fase 3 once auth and RBAC exist.
 */
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Inloggen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            Het inlogscherm wordt gebouwd in Fase 3 (auth en RBAC).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
