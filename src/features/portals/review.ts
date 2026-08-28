import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { createClient } from '@/lib/supabase/server';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';

/**
 * The planner's side of the portal workflow.
 *
 * A request is a proposal, never a change. Approving one records the decision;
 * the planner still makes the actual edit, because "cancel this ride" from a
 * parent and "cancel this ride" from the planning are not the same act — the
 * second one has someone accountable for the consequences.
 */
export interface ReviewableRequest {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly note: string | null;
  readonly createdAt: string;
  readonly requesterKind: string;
  readonly clientName: string;
  readonly clientId: string;
  readonly rideId: string | null;
  readonly rideDate: string | null;
  readonly rideTime: string | null;
}

export async function listRequests(
  organizationId: string,
  status: 'PENDING' | 'ALL' = 'PENDING',
): Promise<ReviewableRequest[]> {
  await requirePermission(organizationId, 'change_requests.view');
  const supabase = await createClient();

  let query = supabase
    .from('change_requests')
    .select(
      `id, kind, status, payload, created_at, requester_kind, client_id, ride_id,
       client:clients!change_requests_client_id_fkey (first_name, last_name),
       ride:rides!change_requests_ride_id_fkey (scheduled_date, scheduled_pickup_time)`,
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (status === 'PENDING') query = query.eq('status', 'PENDING');

  const { data } = await query;

  return (data ?? []).map((row) => {
    const client = row.client as unknown as {
      first_name: string;
      last_name: string;
    } | null;
    const ride = row.ride;
    const payload = row.payload as { note?: string } | null;

    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      note: payload?.note ?? null,
      createdAt: row.created_at,
      requesterKind: row.requester_kind,
      clientName: client ? `${client.first_name} ${client.last_name}` : 'Onbekend',
      clientId: row.client_id,
      rideId: row.ride_id,
      rideDate: ride?.scheduled_date ?? null,
      rideTime: ride?.scheduled_pickup_time ?? null,
    };
  });
}

export async function reviewRequest(
  organizationId: string,
  requestId: string,
  decision: 'APPROVED' | 'REJECTED',
  note: string | null,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'change_requests.review');
  const supabase = await createClient();

  const { data: request } = await supabase
    .from('change_requests')
    .select('id, status, requested_by_user_id')
    .eq('organization_id', organizationId)
    .eq('id', requestId)
    .maybeSingle();

  if (!request) return err(new NotFoundError('Dit verzoek bestaat niet.'));
  if (request.status !== 'PENDING') {
    return err(new ConflictError('Dit verzoek is al beoordeeld.'));
  }

  // Nobody reviews their own request, even with the permission: that would let
  // a staff member who is also a parent approve their own change.
  if (request.requested_by_user_id === user.id) {
    return err(
      new ConflictError('Je kunt je eigen verzoek niet beoordelen. Vraag een collega.'),
    );
  }

  const { error } = await supabase
    .from('change_requests')
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: note,
    })
    .eq('organization_id', organizationId)
    .eq('id', requestId);

  if (error) return err(new ConflictError('De beoordeling kon niet worden opgeslagen.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'change_request.reviewed',
    entityType: 'change_requests',
    entityId: requestId,
    changedFields: [decision],
  });

  return ok(null);
}

export async function countPendingRequests(organizationId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('change_requests')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'PENDING');
  return count ?? 0;
}
