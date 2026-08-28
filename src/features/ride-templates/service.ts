import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { createClient } from '@/lib/supabase/server';
import { generateRidesForOrganization, type GenerationResult } from './generation';
import { type RideTemplateFormInput } from './schema';

export interface TemplateListItem {
  readonly id: string;
  readonly name: string | null;
  readonly departure_time: string;
  readonly days_of_week: number[];
  readonly starts_on: string;
  readonly ends_on: string | null;
  readonly status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  readonly transport_requirements: string[];
  readonly client: { first_name: string; last_name: string } | null;
  readonly pickup: { name: string } | null;
  readonly destination: { name: string } | null;
  readonly driver: { first_name: string; last_name: string } | null;
}

const SELECT = `
  id, name, departure_time, days_of_week, starts_on, ends_on, status,
  transport_requirements,
  client:clients!ride_templates_client_id_fkey (first_name, last_name),
  pickup:locations!ride_templates_pickup_location_id_fkey (name),
  destination:locations!ride_templates_destination_location_id_fkey (name),
  driver:drivers!ride_templates_default_driver_id_fkey (first_name, last_name)
`;

export async function listTemplates(organizationId: string): Promise<TemplateListItem[]> {
  await requirePermission(organizationId, 'ride_templates.view');
  const supabase = await createClient();
  const { data } = await supabase
    .from('ride_templates')
    .select(SELECT)
    .eq('organization_id', organizationId)
    .neq('status', 'ARCHIVED')
    .order('departure_time', { ascending: true })
    .order('id', { ascending: true });
  return data ?? [];
}

export async function getTemplate(organizationId: string, templateId: string) {
  await requirePermission(organizationId, 'ride_templates.view');
  const supabase = await createClient();
  const { data } = await supabase
    .from('ride_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', templateId)
    .maybeSingle();
  return data;
}

function toRecord(input: RideTemplateFormInput) {
  return {
    client_id: input.clientId,
    name: input.name,
    pickup_location_id: input.pickupLocationId,
    destination_location_id: input.destinationLocationId,
    departure_time: input.departureTime,
    days_of_week: input.daysOfWeek,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    default_driver_id: input.defaultDriverId,
    default_vehicle_id: input.defaultVehicleId,
    transport_requirements: input.transportRequirements,
    status: input.status,
  };
}

export async function createTemplate(
  organizationId: string,
  input: RideTemplateFormInput,
): Promise<Result<{ id: string; generated: number }>> {
  const user = await requirePermission(organizationId, 'ride_templates.manage');
  const supabase = await createClient();

  const { data: created } = await supabase
    .from('ride_templates')
    .insert({ organization_id: organizationId, ...toRecord(input), created_by: user.id })
    .select('id')
    .maybeSingle();

  if (!created) {
    return err(new ConflictError('De terugkerende rit kon niet worden opgeslagen.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'ride_template.created',
    entityType: 'ride_templates',
    entityId: created.id,
  });

  // Generate immediately rather than waiting for the nightly job: a planner who
  // just created a recurring ride expects to see it in the planning.
  const result = await generateRidesForOrganization(organizationId);

  return ok({ id: created.id, generated: result.created });
}

export async function editTemplate(
  organizationId: string,
  templateId: string,
  input: RideTemplateFormInput,
): Promise<Result<{ generated: number }>> {
  const user = await requirePermission(organizationId, 'ride_templates.manage');
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('ride_templates')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('id', templateId)
    .maybeSingle();
  if (!existing) return err(new NotFoundError('Deze terugkerende rit bestaat niet.'));

  const { error } = await supabase
    .from('ride_templates')
    .update(toRecord(input))
    .eq('organization_id', organizationId)
    .eq('id', templateId);
  if (error) return err(new ConflictError('De wijziging kon niet worden opgeslagen.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'ride_template.updated',
    entityType: 'ride_templates',
    entityId: templateId,
    changedFields: Object.keys(input),
  });

  const result = await generateRidesForOrganization(organizationId);
  return ok({ generated: result.created });
}

/**
 * How many future rides a template change would affect.
 *
 * Shown before saving, because generation is additive: already-generated rides
 * keep the old time unless a planner also changes them. Without this number a
 * planner cannot tell what "changing the template" actually does.
 */
export async function countFutureRides(
  organizationId: string,
  templateId: string,
): Promise<{ total: number; modified: number }> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [total, modified] = await Promise.all([
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('ride_template_id', templateId)
      .gte('scheduled_date', today),
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('ride_template_id', templateId)
      .gte('scheduled_date', today)
      .eq('is_modified', true),
  ]);

  return { total: total.count ?? 0, modified: modified.count ?? 0 };
}

export async function archiveTemplate(
  organizationId: string,
  templateId: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'ride_templates.manage');
  const supabase = await createClient();

  const { error, count } = await supabase
    .from('ride_templates')
    .update({ status: 'ARCHIVED' }, { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('id', templateId);

  if (error || (count ?? 0) === 0) {
    return err(new ConflictError('De terugkerende rit kon niet worden gestopt.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'ride_template.archived',
    entityType: 'ride_templates',
    entityId: templateId,
  });

  return ok(null);
}

export async function runGeneration(
  organizationId: string,
): Promise<Result<GenerationResult>> {
  const user = await requirePermission(organizationId, 'ride_templates.manage');
  const result = await generateRidesForOrganization(organizationId);

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'rides.generated',
    entityType: 'rides',
    entityId: null,
  });

  return ok(result);
}
