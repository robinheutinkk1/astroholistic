import 'server-only';
import { type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { type Database } from '@/types/database';
import { addDays, localToInstant, todayInTimezone } from '@/lib/datetime/timezone';
import { computeOccurrences } from './occurrences';
import { type Tables } from '@/types/database';

/**
 * Generating rides from recurring templates (masterprompt §14, decision D-06).
 *
 * Three properties this must have, and why:
 *
 *   Idempotent — the job runs nightly and can be triggered by hand. Running it
 *   twice must not double every ride. A partial unique index on
 *   (ride_template_id, scheduled_date) enforces that in the database, because
 *   application logic alone would let two concurrent runs both succeed.
 *
 *   Additive — it only ever inserts. A ride a planner has changed, or one that
 *   has left SCHEDULED, is never touched. That is what makes an exception
 *   (§15) survive the next nightly run.
 *
 *   Bounded — a rolling horizon, not "all future dates". Otherwise a template
 *   with no end date generates rides forever.
 */
export interface GenerationResult {
  readonly created: number;
  readonly skipped: number;
  readonly templatesProcessed: number;
  readonly horizonEnd: string;
}

type TemplateRow = Pick<
  Tables<'ride_templates'>,
  | 'id'
  | 'organization_id'
  | 'client_id'
  | 'pickup_location_id'
  | 'destination_location_id'
  | 'departure_time'
  | 'days_of_week'
  | 'starts_on'
  | 'ends_on'
  | 'default_driver_id'
  | 'default_vehicle_id'
  | 'transport_requirements'
>;

/**
 * The client to run generation with.
 *
 * Two callers, two identities:
 *  - a planner pressing "plan rides" runs with their own session, subject to RLS
 *  - the nightly cron has no session at all, so it passes the service-role
 *    client explicitly
 *
 * This parameter exists because the first version defaulted to the session
 * client, which meant the cron job read zero templates and silently created
 * zero rides — a failure that looks exactly like "nothing to do".
 */
export async function generateRidesForOrganization(
  organizationId: string,
  client?: SupabaseClient<Database>,
): Promise<GenerationResult> {
  const supabase = client ?? (await createClient());

  const { data: settings } = await supabase
    .from('organization_settings')
    .select('timezone, ride_generation_horizon_days')
    .eq('organization_id', organizationId)
    .maybeSingle();

  const timeZone = settings?.timezone ?? 'Europe/Amsterdam';
  const horizonDays = settings?.ride_generation_horizon_days ?? 60;

  const windowStart = todayInTimezone(timeZone);
  const windowEnd = addDays(windowStart, horizonDays);

  const { data: templates } = await supabase
    .from('ride_templates')
    .select(
      `id, organization_id, client_id, pickup_location_id, destination_location_id,
       departure_time, days_of_week, starts_on, ends_on,
       default_driver_id, default_vehicle_id, transport_requirements`,
    )
    .eq('organization_id', organizationId)
    .eq('status', 'ACTIVE');

  let created = 0;
  let skipped = 0;

  for (const template of (templates ?? []) as TemplateRow[]) {
    const dates = computeOccurrences(
      {
        daysOfWeek: template.days_of_week,
        startsOn: template.starts_on,
        endsOn: template.ends_on,
      },
      windowStart,
      windowEnd,
    );
    if (dates.length === 0) continue;

    // One query for all existing dates instead of one per date: a template with
    // a 60-day horizon would otherwise cost 60 round trips, times every
    // template in the organisation.
    const { data: existing } = await supabase
      .from('rides')
      .select('scheduled_date')
      .eq('ride_template_id', template.id)
      .in('scheduled_date', dates);

    const alreadyThere = new Set((existing ?? []).map((row) => row.scheduled_date));
    const missing = dates.filter((date) => !alreadyThere.has(date));
    skipped += dates.length - missing.length;
    if (missing.length === 0) continue;

    // `departure_time` comes back as HH:MM:SS; the conversion wants HH:MM.
    const departureTime = template.departure_time.slice(0, 5);

    const rows = missing.map((date) => ({
      organization_id: template.organization_id,
      client_id: template.client_id,
      ride_template_id: template.id,
      scheduled_date: date,
      scheduled_pickup_time: departureTime,
      // Derived from local date + local time + the organisation's timezone, so
      // an 08:00 pickup stays 08:00 across the DST change (decision D-07).
      scheduled_pickup_at: localToInstant(date, departureTime, timeZone).toISOString(),
      pickup_location_id: template.pickup_location_id,
      destination_location_id: template.destination_location_id,
      driver_id: template.default_driver_id,
      vehicle_id: template.default_vehicle_id,
      status: template.default_driver_id
        ? ('DRIVER_ASSIGNED' as const)
        : ('SCHEDULED' as const),
      source: 'TEMPLATE' as const,
      // Decision D-03a: the transport requirement is inherited, so a planner
      // does not re-enter "wheelchair" 500 times a year.
      transport_requirements: template.transport_requirements,
    }));

    // Ignore duplicates rather than failing the whole run: a concurrent job may
    // have inserted the same date a millisecond earlier, and that is a success,
    // not an error.
    const { data: inserted } = await supabase
      .from('rides')
      .upsert(rows, {
        onConflict: 'ride_template_id,scheduled_date',
        ignoreDuplicates: true,
      })
      .select('id');

    created += inserted?.length ?? 0;
  }

  return {
    created,
    skipped,
    templatesProcessed: templates?.length ?? 0,
    horizonEnd: windowEnd,
  };
}
