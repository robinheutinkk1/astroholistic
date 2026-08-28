-- ---------------------------------------------------------------------------
-- 0018 — Tag check-in, and the rate limiting that protects it.
--
-- Check-in is a single SECURITY DEFINER function because the event and the
-- status change must land together. Doing it as two PostgREST calls allows the
-- state "event written, status not updated", and then the audit trail no longer
-- matches reality (docs/NFC.md §6).
--
-- The function reads nfc_tags, which drivers cannot read directly — that is
-- deliberate: scanning identifies a tag without exposing the tag table. Every
-- path below therefore verifies that the caller is the assigned driver before
-- it returns anything about a person.
-- ---------------------------------------------------------------------------

create type checkin_outcome as enum (
  'CHECKED_IN',
  'ALREADY_CHECKED_IN',
  'NO_ACTIVE_RIDE',
  'NO_ACCESS',
  'UNKNOWN_TAG',
  'NOT_ALLOWED',
  'RATE_LIMITED'
);

-- Scan attempts, for rate limiting. Deliberately in the database rather than in
-- memory: serverless instances do not share memory, so an in-process counter
-- would reset on every cold start.
create table tag_scan_attempts (
  id bigserial primary key,
  user_id uuid references profiles (id) on delete cascade,
  outcome checkin_outcome not null,
  attempted_at timestamptz not null default now()
);
alter table tag_scan_attempts enable row level security;
create index tag_scan_attempts_recent
  on tag_scan_attempts (user_id, attempted_at desc);

-- Nobody reads or writes this through the API: only the SECURITY DEFINER
-- function below touches it. The explicit deny-all policy states that intent,
-- rather than leaving it implied by the absence of any policy — which reads
-- the same to Postgres but not to the next person.
revoke all on tag_scan_attempts from authenticated, anon;

create policy tag_scan_attempts_no_access on tag_scan_attempts
  for all to authenticated
  using (false)
  with check (false);

comment on table tag_scan_attempts is
  'Rate limiting for tag scans. Written only by app.checkin_by_tag_token.';


-- NOTE: this function lives in `public`, unlike every other helper.
--
-- PostgREST only exposes functions in the exposed schema, and this one is meant
-- to be called — it is the check-in endpoint. The `app` helpers stay hidden
-- precisely because they are not. Being callable is the point here, and the
-- function verifies the caller itself rather than relying on being unreachable.
create or replace function public.checkin_by_tag_token(
  p_token_hash bytea,
  p_source event_source default 'NFC'
)
returns table (
  outcome checkin_outcome,
  ride_id uuid,
  client_first_name text,
  client_last_name text,
  occurred_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_recent integer;
  v_tag record;
  v_driver_id uuid;
  v_ride record;
  v_existing timestamptz;
  v_today date;
  v_timezone text;
begin
  if v_user is null then
    return query select 'NOT_ALLOWED'::public.checkin_outcome, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  -- Twenty attempts a minute is far above any real driver and far below what
  -- makes brute forcing a 128-bit token worth trying.
  select count(*) into v_recent
  from public.tag_scan_attempts
  where user_id = v_user and attempted_at > now() - interval '1 minute';

  if v_recent >= 20 then
    insert into public.tag_scan_attempts (user_id, outcome) values (v_user, 'RATE_LIMITED');
    return query select 'RATE_LIMITED'::public.checkin_outcome, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  -- ORDER MATTERS HERE, and getting it wrong is a real leak.
  --
  -- The first version looked up the tag, then checked the driver, and answered
  -- UNKNOWN_TAG for a token that does not exist but NO_ACCESS for a real token
  -- belonging to another organisation. That difference is an oracle: anyone
  -- with any driver account could tell a genuine TagPoint tag from a random
  -- string, and confirm which organisation it did not belong to.
  --
  -- So: establish who the caller is first, and treat "not a tag" and "not YOUR
  -- tag" as the same answer.

  -- Is the caller a driver at all? This says nothing about any tag.
  if not exists (
    select 1 from public.drivers d
    where d.user_id = v_user and d.deleted_at is null
  ) then
    insert into public.tag_scan_attempts (user_id, outcome) values (v_user, 'NO_ACCESS');
    return query select 'NO_ACCESS'::public.checkin_outcome, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  -- The tag, but only if it belongs to an organisation the caller drives for.
  -- A tag from anywhere else simply does not exist as far as they are
  -- concerned — same answer as a random string.
  select t.id, t.organization_id, t.client_id, t.status
  into v_tag
  from public.nfc_tags t
  join public.drivers d
    on d.organization_id = t.organization_id
   and d.user_id = v_user
   and d.deleted_at is null
  where t.token_hash = p_token_hash;

  -- Unknown, foreign, inactive and unassigned tags all answer identically.
  if v_tag is null or v_tag.status <> 'ACTIVE' or v_tag.client_id is null then
    insert into public.tag_scan_attempts (user_id, outcome) values (v_user, 'UNKNOWN_TAG');
    return query select 'UNKNOWN_TAG'::public.checkin_outcome, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  select d.id into v_driver_id
  from public.drivers d
  where d.user_id = v_user
    and d.organization_id = v_tag.organization_id
    and d.deleted_at is null;

  select s.timezone into v_timezone
  from public.organization_settings s
  where s.organization_id = v_tag.organization_id;
  v_today := (now() at time zone coalesce(v_timezone, 'Europe/Amsterdam'))::date;

  -- Today's ride for this client, assigned to this driver, at a point in the
  -- workflow where boarding makes sense. Nearest departure first, so the
  -- morning run wins over the afternoon one.
  select r.id, r.status, r.client_id, r.organization_id
  into v_ride
  from public.rides r
  where r.client_id = v_tag.client_id
    and r.driver_id = v_driver_id
    and r.scheduled_date = v_today
    and r.status in ('DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'CLIENT_CHECKED_IN')
  order by abs(extract(epoch from (r.scheduled_pickup_at - now())))
  limit 1;

  if v_ride is null then
    insert into public.tag_scan_attempts (user_id, outcome) values (v_user, 'NO_ACTIVE_RIDE');
    return query select 'NO_ACTIVE_RIDE'::public.checkin_outcome, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  -- Already checked in: report it as a success with the original time. A driver
  -- tapping twice because nothing visibly happened has done nothing wrong
  -- (masterprompt §60).
  select e.occurred_at into v_existing
  from public.ride_events e
  where e.ride_id = v_ride.id and e.event_type = 'CLIENT_CHECKED_IN'
  limit 1;

  if v_existing is not null then
    insert into public.tag_scan_attempts (user_id, outcome) values (v_user, 'ALREADY_CHECKED_IN');
    return query
      select 'ALREADY_CHECKED_IN'::public.checkin_outcome, v_ride.id,
             c.first_name, c.last_name, v_existing
      from public.clients c where c.id = v_ride.client_id;
    return;
  end if;

  -- A driver who has not yet reported arriving is checking someone in from the
  -- road. Move the ride along rather than refusing: the tap itself is proof of
  -- presence, and blocking here would strand the driver at the door.
  if v_ride.status = 'DRIVER_EN_ROUTE' then
    update public.rides set status = 'DRIVER_ARRIVED' where id = v_ride.id;
    insert into public.ride_events (organization_id, ride_id, event_type, actor_user_id,
                                    actor_kind, source, nfc_tag_id)
    values (v_ride.organization_id, v_ride.id, 'DRIVER_ARRIVED', v_user, 'DRIVER', p_source, v_tag.id);
  end if;

  update public.rides
  set status = 'CLIENT_CHECKED_IN',
      checked_in_at = now(),
      checked_in_method = p_source
  where id = v_ride.id;

  insert into public.ride_events (organization_id, ride_id, event_type, actor_user_id,
                                  actor_kind, source, nfc_tag_id)
  values (v_ride.organization_id, v_ride.id, 'CLIENT_CHECKED_IN', v_user, 'DRIVER',
          p_source, v_tag.id);

  insert into public.tag_scan_attempts (user_id, outcome) values (v_user, 'CHECKED_IN');

  return query
    select 'CHECKED_IN'::public.checkin_outcome, v_ride.id, c.first_name, c.last_name, now()
    from public.clients c where c.id = v_ride.client_id;
end;
$$;

revoke all on function public.checkin_by_tag_token(bytea, event_source) from public;
grant execute on function public.checkin_by_tag_token(bytea, event_source) to authenticated;

comment on function public.checkin_by_tag_token is
  'Resolves a tag token and checks the client in, atomically. Returns a client '
  'name only after verifying the caller is the driver assigned to that ride.';
