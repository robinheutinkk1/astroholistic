import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { DispatchBoard } from '@/features/dispatch/components/dispatch-board';
import { getDispatchBoard } from '@/features/dispatch/service';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dispatch' };

/**
 * The live board. Always rendered fresh: a cached dispatch screen is a screen
 * that lies about where the buses are.
 */
export const dynamic = 'force-dynamic';

export default async function DispatchPage() {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('rides.dispatch')) redirect('/dashboard');

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('timezone')
    .eq('organization_id', membership.organizationId)
    .maybeSingle();

  const board = await getDispatchBoard(
    membership.organizationId,
    settings?.timezone ?? 'Europe/Amsterdam',
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dispatch</h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Wat er nu op de weg gebeurt.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <DispatchBoard board={board} organizationId={membership.organizationId} />
        </CardContent>
      </Card>
    </div>
  );
}
