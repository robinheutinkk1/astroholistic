import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Placeholder landing page for Fase 1. Replaced in Fase 3 by the real sign-in
 * flow and the organisation shell.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">TagPoint Taxi Dispatch</h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Planning, dispatch en ritregistratie voor vervoersbedrijven.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fase 1 — projectfundament</CardTitle>
          <CardDescription>
            De basis staat: strict TypeScript, design tokens, Supabase-clients,
            foutafhandeling en de ritstatus-state machine. Database en RLS volgen in Fase
            2.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/login">Naar inloggen</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
