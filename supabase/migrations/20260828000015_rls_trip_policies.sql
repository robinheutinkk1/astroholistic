-- ---------------------------------------------------------------------------
-- 0015 — Policies for the group-transport tables.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on trips, trip_stops, trip_templates
  to authenticated;

-- Trips a driver is assigned to, used by the driver-facing policies below.
create or replace function app.driver_trip_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(t.id), '{}')
  from public.trips t
  join public.drivers d on d.id = t.driver_id
  where d.user_id = (select auth.uid())
    and t.scheduled_date between (current_date - 1) and (current_date + 30);
$$;

revoke all on function app.driver_trip_ids() from public;
grant execute on function app.driver_trip_ids() to authenticated;

create policy trips_select on trips for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('planning.view'))::uuid[])
  -- A driver sees the runs assigned to them, and only those.
  or id = any ((select app.driver_trip_ids())::uuid[])
);

create policy trips_insert on trips for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('planning.manage'))::uuid[]));

-- A driver may update their own trip because starting and finishing a run
-- happens from the PWA. Planners get the same right through planning.manage.
create policy trips_update on trips for update to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('planning.manage'))::uuid[])
  or id = any ((select app.driver_trip_ids())::uuid[])
)
with check (
  organization_id = any ((select app.permitted_org_ids('planning.manage'))::uuid[])
  or id = any ((select app.driver_trip_ids())::uuid[])
);

create policy trips_delete on trips for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('planning.manage'))::uuid[]));

create policy trip_stops_select on trip_stops for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('planning.view'))::uuid[])
  or trip_id = any ((select app.driver_trip_ids())::uuid[])
);

create policy trip_stops_insert on trip_stops for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('planning.manage'))::uuid[]));

-- The driver's single "I have arrived" for the whole stop lands here.
create policy trip_stops_update on trip_stops for update to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('planning.manage'))::uuid[])
  or trip_id = any ((select app.driver_trip_ids())::uuid[])
)
with check (
  organization_id = any ((select app.permitted_org_ids('planning.manage'))::uuid[])
  or trip_id = any ((select app.driver_trip_ids())::uuid[])
);

create policy trip_stops_delete on trip_stops for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('planning.manage'))::uuid[]));

create policy trip_templates_select on trip_templates for select to authenticated
using (organization_id = any ((select app.permitted_org_ids('ride_templates.view'))::uuid[]));

create policy trip_templates_insert on trip_templates for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('ride_templates.manage'))::uuid[]));

create policy trip_templates_update on trip_templates for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('ride_templates.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('ride_templates.manage'))::uuid[]));

create policy trip_templates_delete on trip_templates for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('ride_templates.manage'))::uuid[]));
