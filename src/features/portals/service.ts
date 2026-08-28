import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { AuthorizationError, ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { todayInTimezone } from '@/lib/datetime/timezone';
import { type RideStatus } from '@/features/rides/status';
import { getPortalAccess, getPortalClient, type PortalClient } from './access';

/**
 * What a portal user may read and ask for.
 *
 * Portals NEVER write to `rides` (decision D-08). Everything they want becomes
 * a `change_request` that a planner reviews. Without that, a parent cancelling
 * at 05:00 would silently reshape a planning nobody has looked at yet, with no
 * record of who did it.
 */
export interface PortalRide {
  readonly id: string;
  readonly scheduledDate: string;
  readonly scheduledPickupTime: string;
  readonly status: RideStatus;
  readonly pickupName: string | null;
  readonly destinationName: string | null;
  readonly driverFirstName: string | null;
  readonly absenceReason: string | null;
  readonly hasPendingRequest: boolean;
}

const RIDE_SELECT = `
  id, scheduled_date, scheduled_pickup_time, status, absence_reason,
  pickup:locations!rides_pickup_location_id_fkey (name),
  destination:locations!rides_destination_location_id_fkey (name),
  driver:drivers!rides_driver_id_fkey (first_name)
`;

async function organizationTimezone(organizationId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_settings')
    .select('timezone')
    .eq('organization_id', organizationId)
    .maybeSingle();
  return data?.timezone ?? 'Europe/Amsterdam';
}

export async function getClientRides(
  client: PortalClient,
  scope: 'upcoming' | 'past',
): Promise<PortalRide[]> {
  const supabase = await createClient();
  const today = todayInTimezone(await organizationTimezone(client.organizationId));

  let query = supabase
    .from('rides')
    .select(RIDE_SELECT)
    // RLS restricts this to clients the caller may follow; the filter is for
    // the right client, not for safety.
    .eq('client_id', client.id);

  query =
    scope === 'upcoming'
      ? query
          .gte('scheduled_date', today)
          .order('scheduled_pickup_at', { ascending: true })
      : query
          .lt('scheduled_date', today)
          .order('scheduled_pickup_at', { ascending: false });

  const { data } = await query.limit(scope === 'upcoming' ? 50 : 20);

  const rideIds = (data ?? []).map((row) => row.id);
  const pending = new Set<string>();
  if (rideIds.length > 0) {
    const { data: requests } = await supabase
      .from('change_requests')
      .select('ride_id')
      .in('ride_id', rideIds)
      .eq('status', 'PENDING');
    for (const request of requests ?? []) {
      if (request.ride_id) pending.add(request.ride_id);
    }
  }

  return (data ?? []).map((row) => {
    const pickup = row.pickup as unknown as { name: string } | null;
    const destination = row.destination as unknown as { name: string } | null;
    const driver = row.driver;

    return {
      id: row.id,
      scheduledDate: row.scheduled_date,
      scheduledPickupTime: row.scheduled_pickup_time,
      status: row.status,
      pickupName: pickup?.name ?? null,
      destinationName: destination?.name ?? null,
      // First name only: a portal user has no business knowing which employee
      // drives, beyond recognising them at the door.
      driverFirstName: driver?.first_name ?? null,
      absenceReason: row.absence_reason,
      hasPendingRequest: pending.has(row.id),
    };
  });
}

export interface PortalRequest {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly createdAt: string;
  readonly reviewNote: string | null;
  readonly rideDate: string | null;
}

export async function getClientRequests(client: PortalClient): Promise<PortalRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('change_requests')
    .select(
      `id, kind, status, created_at, review_note,
       ride:rides!change_requests_ride_id_fkey (scheduled_date)`,
    )
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    createdAt: row.created_at,
    reviewNote: row.review_note,
    rideDate: row.ride?.scheduled_date ?? null,
  }));
}

export type RequestKind =
  'ABSENCE' | 'TIME_CHANGE' | 'DESTINATION_CHANGE' | 'CANCEL' | 'OTHER';

export interface SubmitRequestInput {
  readonly clientId: string;
  readonly rideId: string | null;
  readonly kind: RequestKind;
  readonly note: string | null;
}

export async function submitRequest(
  input: SubmitRequestInput,
): Promise<Result<{ id: string }>> {
  const access = await getPortalAccess();
  const client = await getPortalClient(input.clientId);
  if (!client) return err(new NotFoundError('Deze cliënt is niet bekend.'));

  // Capabilities live on the relationship row, so a parent can report an
  // absence for one child and not another (docs/DATABASE.md §5).
  const allowed =
    input.kind === 'ABSENCE' ? client.canReportAbsence : client.canRequestChanges;
  if (!allowed) {
    return err(
      new AuthorizationError(
        'Je mag hiervoor geen verzoek indienen. Neem contact op met de vervoerder.',
      ),
    );
  }

  const supabase = await createClient();

  if (input.rideId) {
    // Only rides of this client, and only ones still ahead. A request about a
    // ride that already happened is noise for the planner.
    const { data: ride } = await supabase
      .from('rides')
      .select('id, status')
      .eq('id', input.rideId)
      .eq('client_id', client.id)
      .maybeSingle();

    if (!ride) return err(new NotFoundError('Deze rit is niet bekend.'));
    if (['COMPLETED', 'CANCELLED', 'CLIENT_ABSENT'].includes(ride.status)) {
      return err(new ConflictError('Deze rit is al afgerond of vervallen.'));
    }

    const { data: existing } = await supabase
      .from('change_requests')
      .select('id')
      .eq('ride_id', input.rideId)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (existing) {
      return err(new ConflictError('Er staat al een verzoek open voor deze rit.'));
    }
  }

  const { data: created, error } = await supabase
    .from('change_requests')
    .insert({
      organization_id: client.organizationId,
      client_id: client.id,
      ride_id: input.rideId,
      requested_by_user_id: access.userId,
      requester_kind: client.relationships.includes('CLIENT')
        ? 'CLIENT'
        : client.relationships.includes('CONTACT')
          ? 'CONTACT'
          : 'CARE_ORG',
      kind: input.kind,
      payload: input.note ? { note: input.note } : {},
    })
    .select('id')
    .maybeSingle();

  if (error || !created) {
    return err(new ConflictError('Het verzoek kon niet worden verstuurd.'));
  }

  return ok(created);
}
