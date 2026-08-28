-- ---------------------------------------------------------------------------
-- 0008 — Audit log, notifications, portal change requests, and the database
--        side of the ride state machine.
-- ---------------------------------------------------------------------------

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- Null for platform-level actions, which belong to no tenant.
  organization_id uuid references organizations (id) on delete cascade,
  actor_user_id uuid references profiles (id) on delete set null,
  actor_kind actor_kind not null default 'SYSTEM',
  action text not null,
  entity_type text not null,
  entity_id uuid,
  -- Changed field NAMES, not old and new personal values (docs/SECURITY.md §11).
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table audit_logs enable row level security;
create index audit_logs_org_time_idx on audit_logs (organization_id, created_at desc);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);

create trigger audit_logs_append_only
  before update or delete on audit_logs
  for each row execute function app.forbid_mutation();

create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  recipient_user_id uuid not null references profiles (id) on delete cascade,
  channel notification_channel not null default 'IN_APP',
  kind text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table notifications enable row level security;
create index notifications_recipient_idx
  on notifications (recipient_user_id, created_at desc);
create index notifications_unread_idx
  on notifications (recipient_user_id) where read_at is null;

-- Portals never write to `rides` directly (decision D-08). They file a request
-- that a planner reviews, so an overnight cancellation always has an author.
create table change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  ride_id uuid references rides (id) on delete cascade,
  requested_by_user_id uuid references profiles (id) on delete set null,
  requester_kind requester_kind not null,
  kind change_request_kind not null,
  payload jsonb not null default '{}'::jsonb,
  status change_request_status not null default 'PENDING',
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint change_requests_reviewed_together
    check ((reviewed_by is null) = (reviewed_at is null))
);
alter table change_requests enable row level security;
create index change_requests_org_status_idx on change_requests (organization_id, status, created_at desc);
create index change_requests_client_idx on change_requests (client_id, created_at desc);
create index change_requests_ride_idx on change_requests (ride_id) where ride_id is not null;

create trigger change_requests_touch before update on change_requests
  for each row execute function app.touch_updated_at();


-- ---------------------------------------------------------------------------
-- Ride state machine, enforced in the database.
--
-- This mirrors src/features/rides/status.ts. Having it in both places is
-- deliberate: the TypeScript version gives good errors and drives the UI, the
-- database version survives someone calling the REST API directly
-- (masterprompt §61). The pgTAP suite asserts the two agree.
-- ---------------------------------------------------------------------------
create or replace function app.ride_status_transition_allowed(
  p_from ride_status,
  p_to ride_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    -- Terminal statuses go nowhere.
    when p_from in ('COMPLETED', 'CLIENT_ABSENT', 'CANCELLED') then false
    when p_from = p_to then false
    -- Any active ride can be cancelled or flagged as a problem.
    when p_to in ('CANCELLED', 'PROBLEM') then true
    when p_from = 'SCHEDULED' then p_to = 'DRIVER_ASSIGNED'
    when p_from = 'DRIVER_ASSIGNED' then p_to in ('DRIVER_EN_ROUTE', 'SCHEDULED')
    when p_from = 'DRIVER_EN_ROUTE' then p_to = 'DRIVER_ARRIVED'
    when p_from = 'DRIVER_ARRIVED' then p_to in ('CLIENT_CHECKED_IN', 'CLIENT_ABSENT')
    when p_from = 'CLIENT_CHECKED_IN' then p_to = 'TRIP_STARTED'
    when p_from = 'TRIP_STARTED' then p_to = 'ARRIVED'
    when p_from = 'ARRIVED' then p_to = 'COMPLETED'
    -- A dispatcher resolves a problem back into the flow, but never back to
    -- SCHEDULED: a driver was already involved and that fact must not vanish.
    when p_from = 'PROBLEM' then p_to in (
      'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED',
      'CLIENT_CHECKED_IN', 'TRIP_STARTED', 'ARRIVED',
      'COMPLETED', 'CLIENT_ABSENT'
    )
    else false
  end;
$$;

create or replace function app.enforce_ride_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_checkout_mode public.checkout_mode;
  v_has_checkout boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  if not app.ride_status_transition_allowed(old.status, new.status) then
    raise exception 'Illegal ride status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  -- Check-out is an event, not a status (decision D-09), so the organisation's
  -- policy shows up here as a guard rather than as an extra state.
  if new.status = 'COMPLETED' and old.status = 'ARRIVED' then
    select s.checkout_mode into v_checkout_mode
    from public.organization_settings s
    where s.organization_id = new.organization_id;

    if v_checkout_mode = 'REQUIRED' then
      select exists (
        select 1 from public.ride_events e
        where e.ride_id = new.id and e.event_type = 'CLIENT_CHECKED_OUT'
      ) into v_has_checkout;

      if not v_has_checkout then
        raise exception 'Check-out is required before this ride can be completed'
          using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger rides_status_transition
  before update of status on rides
  for each row execute function app.enforce_ride_status_transition();
