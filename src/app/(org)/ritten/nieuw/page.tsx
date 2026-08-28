import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RideForm } from '@/features/rides/components/ride-form';
import { loadPickerOptions } from '@/features/rides/pickers';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { todayInTimezone } from '@/lib/datetime/timezone';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Nieuwe rit' };

export default async function NewRidePage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('rides.create')) redirect('/planning');

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('timezone')
    .eq('organization_id', membership.organizationId)
    .maybeSingle();

  const { datum } = await searchParams;
  const today = todayInTimezone(settings?.timezone ?? 'Europe/Amsterdam');
  const options = await loadPickerOptions(membership.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Nieuwe rit</h1>
      <Card>
        <CardHeader>
          <CardTitle>Ritgegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <RideForm
            {...options}
            defaultDate={datum && /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : today}
          />
        </CardContent>
      </Card>
    </div>
  );
}
