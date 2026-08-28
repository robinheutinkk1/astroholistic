-- ---------------------------------------------------------------------------
-- 0020 — Separate "clients I may see" from "rides I may see".
--
-- WHAT WAS WRONG
-- --------------
-- `app.visible_client_ids()` unions four sources: the client themselves, their
-- contacts, their care organisation, and — the problem — every client a driver
-- has a ride for. The ride policies then used that same helper, so a driver
-- could see EVERY ride of any client they happened to drive once, including
-- rides assigned to colleagues.
--
-- Concretely: Kees drives Jan at 08:00. That made Jan visible to Kees, which is
-- correct. But it also showed Kees the 16:00 group trip Sanne drives — another
-- driver's assignment, and Jan's full daily movement pattern.
--
-- docs/SECURITY.md §1 says the ride pattern is as sensitive as the address, so
-- this is a real leak rather than an inconvenience.
--
-- THE FIX
-- -------
-- Two helpers instead of one:
--   app.visible_client_ids()  — who may I see as a person (drivers included)
--   app.portal_client_ids()   — whose rides may I follow (drivers EXCLUDED)
--
-- A driver's access to rides now comes exclusively from the assignment itself.
-- ---------------------------------------------------------------------------

create or replace function app.portal_client_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select distinct unnest(
      app.self_client_ids()
      || app.contact_client_ids()
      || app.care_org_client_ids()
    )
  );
$$;

revoke all on function app.portal_client_ids() from public;
grant execute on function app.portal_client_ids() to authenticated;

comment on function app.portal_client_ids is
  'Clients whose rides the caller may follow: themselves, their linked '
  'contacts, and their care organisation. Deliberately excludes the driver '
  'path — a driver reaches a ride through the assignment, not through the '
  'client.';

-- --- Rides -----------------------------------------------------------------
drop policy rides_select on rides;
create policy rides_select on rides for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('rides.view'))::uuid[])
  -- A driver sees the rides assigned to them, and only those.
  or driver_id = any ((select app.driver_ids())::uuid[])
  -- Portals follow their own client's rides.
  or client_id = any ((select app.portal_client_ids())::uuid[])
);

-- --- Ride events -----------------------------------------------------------
drop policy ride_events_select on ride_events;
create policy ride_events_select on ride_events for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('rides.view'))::uuid[])
  or exists (
    select 1 from rides r
    where r.id = ride_events.ride_id
      and (
        r.driver_id = any ((select app.driver_ids())::uuid[])
        or r.client_id = any ((select app.portal_client_ids())::uuid[])
      )
  )
);

-- --- Recurring templates ---------------------------------------------------
drop policy ride_templates_select on ride_templates;
create policy ride_templates_select on ride_templates for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('ride_templates.view'))::uuid[])
  or client_id = any ((select app.portal_client_ids())::uuid[])
);

-- --- Locations -------------------------------------------------------------
drop policy locations_select on locations;
create policy locations_select on locations for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('locations.view'))::uuid[])
  or exists (
    select 1 from rides r
    where (r.pickup_location_id = locations.id or r.destination_location_id = locations.id)
      and (
        r.driver_id = any ((select app.driver_ids())::uuid[])
        or r.client_id = any ((select app.portal_client_ids())::uuid[])
      )
  )
);

-- --- Change requests -------------------------------------------------------
drop policy change_requests_select on change_requests;
create policy change_requests_select on change_requests for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('change_requests.view'))::uuid[])
  or requested_by_user_id = (select auth.uid())
  or client_id = any ((select app.portal_client_ids())::uuid[])
);

drop policy change_requests_insert on change_requests;
create policy change_requests_insert on change_requests for insert to authenticated
with check (
  requested_by_user_id = (select auth.uid())
  and (
    organization_id = any ((select app.permitted_org_ids('change_requests.review'))::uuid[])
    or client_id = any ((select app.portal_client_ids())::uuid[])
  )
);
