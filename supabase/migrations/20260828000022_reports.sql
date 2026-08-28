-- ---------------------------------------------------------------------------
-- 0022 — Reporting aggregates (§28, Fase 11).
--
-- WHY THESE ARE `SECURITY INVOKER`. Every other helper in this schema that
-- reaches across rows is SECURITY DEFINER, because it has to answer a question
-- the caller may not ask directly. These are the opposite: they aggregate the
-- caller's *own* rides, so they must run with the caller's own privileges and
-- let RLS do the filtering. A SECURITY DEFINER report would silently become a
-- hole straight through the tenant boundary — a single missing WHERE clause
-- and organisation A counts organisation B's rides.
--
-- The explicit `security invoker` below is the default, and is written out
-- anyway: in this file it is a decision, not an omission.
--
-- The permission check is defence in depth. RLS already stops a driver reading
-- rides they are not assigned to, but a driver aggregating their own rides
-- into a report is still not something the product offers, and "returns rows
-- but not the ones you expected" is a worse answer than "returns nothing".
--
-- BUCKETING USES `scheduled_date`, NOT `scheduled_pickup_at`. That column is
-- already the local calendar date in the organisation's own timezone, so a ride
-- at 00:30 on a Monday in Amsterdam counts as Monday without any conversion —
-- and it keeps counting as Monday across a DST boundary. Grouping on the
-- timestamptz would quietly file some rides under the previous day.
-- ---------------------------------------------------------------------------

-- Punctuality threshold. A check-in within five minutes of the planned pickup
-- counts as on time. Five is a judgement, not a fact: it is written once, here,
-- so changing it is one edit rather than a hunt through four functions.
create or replace function app.punctuality_grace()
returns interval
language sql
immutable
as $$ select interval '5 minutes' $$;

grant execute on function app.punctuality_grace() to authenticated;

-- --- 1. One-line summary over a period ------------------------------------
create or replace function public.report_ride_summary(
  p_organization_id uuid,
  p_from date,
  p_to date
)
returns table (
  total bigint,
  completed bigint,
  cancelled bigint,
  absent bigint,
  problem bigint,
  open bigint,
  checkin_nfc bigint,
  checkin_qr bigint,
  checkin_manual bigint,
  measured bigint,
  on_time bigint,
  late bigint,
  avg_delay_seconds numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)                                                          as total,
    count(*) filter (where r.status = 'COMPLETED')                    as completed,
    count(*) filter (where r.status = 'CANCELLED')                    as cancelled,
    count(*) filter (where r.status = 'CLIENT_ABSENT')                as absent,
    count(*) filter (where r.status = 'PROBLEM')                      as problem,
    count(*) filter (
      where r.status not in ('COMPLETED', 'CANCELLED', 'CLIENT_ABSENT', 'PROBLEM')
    )                                                                 as open,
    count(*) filter (where r.checked_in_method = 'NFC')               as checkin_nfc,
    count(*) filter (where r.checked_in_method = 'QR')                as checkin_qr,
    count(*) filter (where r.checked_in_method = 'MANUAL')            as checkin_manual,
    -- Punctuality is only meaningful where a check-in actually happened.
    -- Counting a cancelled ride as "on time" would flatter every figure.
    count(*) filter (where r.checked_in_at is not null)               as measured,
    count(*) filter (
      where r.checked_in_at is not null
        and r.checked_in_at <= r.scheduled_pickup_at + app.punctuality_grace()
    )                                                                 as on_time,
    count(*) filter (
      where r.checked_in_at is not null
        and r.checked_in_at > r.scheduled_pickup_at + app.punctuality_grace()
    )                                                                 as late,
    avg(extract(epoch from (r.checked_in_at - r.scheduled_pickup_at)))
      filter (where r.checked_in_at is not null)                      as avg_delay_seconds
  from public.rides r
  where r.organization_id = p_organization_id
    and r.scheduled_date between p_from and p_to
    and app.has_permission(p_organization_id, 'reports.view');
$$;

-- --- 2. Rides per day -----------------------------------------------------
create or replace function public.report_rides_per_day(
  p_organization_id uuid,
  p_from date,
  p_to date
)
returns table (
  day date,
  total bigint,
  completed bigint,
  absent bigint,
  cancelled bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.scheduled_date                                    as day,
    count(*)                                            as total,
    count(*) filter (where r.status = 'COMPLETED')      as completed,
    count(*) filter (where r.status = 'CLIENT_ABSENT')  as absent,
    count(*) filter (where r.status = 'CANCELLED')      as cancelled
  from public.rides r
  where r.organization_id = p_organization_id
    and r.scheduled_date between p_from and p_to
    and app.has_permission(p_organization_id, 'reports.view')
  group by r.scheduled_date
  order by r.scheduled_date;
$$;

-- --- 3. Per driver --------------------------------------------------------
--
-- LEFT JOIN, deliberately. An inner join would drop rides whose driver row the
-- caller cannot read, and the totals here would then disagree with the summary
-- above for no visible reason. An unreadable or unassigned driver shows up as
-- one "unknown" bucket instead.
create or replace function public.report_by_driver(
  p_organization_id uuid,
  p_from date,
  p_to date
)
returns table (
  driver_id uuid,
  driver_name text,
  total bigint,
  completed bigint,
  absent bigint,
  measured bigint,
  on_time bigint,
  avg_delay_seconds numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.driver_id,
    max(d.first_name || ' ' || d.last_name)                           as driver_name,
    count(*)                                                          as total,
    count(*) filter (where r.status = 'COMPLETED')                    as completed,
    count(*) filter (where r.status = 'CLIENT_ABSENT')                as absent,
    count(*) filter (where r.checked_in_at is not null)               as measured,
    count(*) filter (
      where r.checked_in_at is not null
        and r.checked_in_at <= r.scheduled_pickup_at + app.punctuality_grace()
    )                                                                 as on_time,
    avg(extract(epoch from (r.checked_in_at - r.scheduled_pickup_at)))
      filter (where r.checked_in_at is not null)                      as avg_delay_seconds
  from public.rides r
  left join public.drivers d on d.id = r.driver_id
  where r.organization_id = p_organization_id
    and r.scheduled_date between p_from and p_to
    and app.has_permission(p_organization_id, 'reports.view')
  group by r.driver_id
  order by count(*) desc, r.driver_id;
$$;

-- --- 4. Per client --------------------------------------------------------
--
-- NOTE WHAT IS ABSENT: no breakdown by `absence_reason`. One of those reasons
-- is 'ILL'. A per-person tally of illnesses is a health record, which this
-- product deliberately does not keep (§8, §38, decision D-03) — and a report is
-- exactly how one gets built by accident, one harmless-looking column at a
-- time. The organisation-wide breakdown in report_absence_reasons() answers the
-- operational question ("why do rides fall through?") without profiling anyone.
create or replace function public.report_by_client(
  p_organization_id uuid,
  p_from date,
  p_to date
)
returns table (
  client_id uuid,
  client_name text,
  total bigint,
  completed bigint,
  absent bigint,
  cancelled bigint,
  last_ride_date date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.client_id,
    max(c.first_name || ' ' || c.last_name)             as client_name,
    count(*)                                            as total,
    count(*) filter (where r.status = 'COMPLETED')      as completed,
    count(*) filter (where r.status = 'CLIENT_ABSENT')  as absent,
    count(*) filter (where r.status = 'CANCELLED')      as cancelled,
    max(r.scheduled_date)                               as last_ride_date
  from public.rides r
  left join public.clients c on c.id = r.client_id
  where r.organization_id = p_organization_id
    and r.scheduled_date between p_from and p_to
    and app.has_permission(p_organization_id, 'reports.view')
  group by r.client_id
  order by count(*) desc, r.client_id;
$$;

-- --- 5. Why rides fall through, organisation-wide -------------------------
create or replace function public.report_absence_reasons(
  p_organization_id uuid,
  p_from date,
  p_to date
)
returns table (
  reason public.absence_reason,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.absence_reason as reason, count(*) as total
  from public.rides r
  where r.organization_id = p_organization_id
    and r.scheduled_date between p_from and p_to
    and r.status = 'CLIENT_ABSENT'
    and app.has_permission(p_organization_id, 'reports.view')
  group by r.absence_reason
  order by count(*) desc, r.absence_reason;
$$;

-- --- 6. The care organisation's own clients -------------------------------
--
-- Promised in docs/ROLES_AND_PERMISSIONS.md §6: an opdrachtgever sees figures
-- for the clients they fund. They hold no membership and therefore no
-- `reports.view`, so this is a separate function scoped by the relationship
-- rather than by a permission — and it takes no organisation parameter,
-- because a contact or care organisation can legitimately reach clients at
-- more than one transport company.
--
-- app.portal_client_ids() is the same helper the portal itself uses (migration
-- 0020), so a client that disappears from the portal disappears from the report
-- in the same statement.
create or replace function public.report_portal_client_summary(
  p_from date,
  p_to date
)
returns table (
  client_id uuid,
  client_name text,
  total bigint,
  completed bigint,
  absent bigint,
  cancelled bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.client_id,
    max(c.first_name || ' ' || c.last_name)             as client_name,
    count(*)                                            as total,
    count(*) filter (where r.status = 'COMPLETED')      as completed,
    count(*) filter (where r.status = 'CLIENT_ABSENT')  as absent,
    count(*) filter (where r.status = 'CANCELLED')      as cancelled
  from public.rides r
  left join public.clients c on c.id = r.client_id
  where r.client_id = any (app.portal_client_ids())
    and r.scheduled_date between p_from and p_to
  group by r.client_id
  order by max(c.last_name), r.client_id;
$$;

revoke all on function public.report_ride_summary(uuid, date, date) from public;
revoke all on function public.report_rides_per_day(uuid, date, date) from public;
revoke all on function public.report_by_driver(uuid, date, date) from public;
revoke all on function public.report_by_client(uuid, date, date) from public;
revoke all on function public.report_absence_reasons(uuid, date, date) from public;
revoke all on function public.report_portal_client_summary(date, date) from public;

grant execute on function public.report_ride_summary(uuid, date, date) to authenticated;
grant execute on function public.report_rides_per_day(uuid, date, date) to authenticated;
grant execute on function public.report_by_driver(uuid, date, date) to authenticated;
grant execute on function public.report_by_client(uuid, date, date) to authenticated;
grant execute on function public.report_absence_reasons(uuid, date, date) to authenticated;
grant execute on function public.report_portal_client_summary(date, date) to authenticated;
