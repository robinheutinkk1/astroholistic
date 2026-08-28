-- ---------------------------------------------------------------------------
-- 0024 — Support access becomes real (decision D-02).
--
-- The grant table, its policies and `app.support_org_ids()` have existed since
-- migration 0003. What they unlocked, until now, was one row: the organisation
-- itself. A tenant could grant support access, see it listed, watch it expire —
-- and it did nothing. A control that looks like it works and does not is worse
-- than an absent one, because everybody stops asking.
--
-- TWO SCOPES, BECAUSE ONE IS WRONG EITHER WAY.
-- A single "support may read everything" grant means a support engineer reads a
-- child's home address to diagnose a scheduling bug. A single "support may read
-- nothing personal" grant means the ticket "the wrong address is used for Jan"
-- cannot be answered at all. So the tenant chooses per grant, and the default
-- in the UI is the smaller one.
--
-- SUPPORT IS READ-ONLY. Not one INSERT, UPDATE or DELETE policy is extended
-- below. A support engineer who needs something changed asks the organisation
-- to change it — which keeps the tenant in control of their own data and keeps
-- the audit trail honest about who did what.
-- ---------------------------------------------------------------------------

create type support_access_scope as enum ('OPERATIONAL', 'PERSONAL');

alter table support_access_grants
  add column scope support_access_scope not null default 'OPERATIONAL';

comment on column support_access_grants.scope is
  'OPERATIONAL: rides, events, fleet, settings. PERSONAL: also client and contact details.';

-- --- The helpers ----------------------------------------------------------
--
-- The existing no-argument app.support_org_ids() is left exactly as it is: it
-- means "any live grant", which is the right question for the organisation row
-- itself. The two below are the ones the policies use.
create or replace function app.support_org_ids(p_scope support_access_scope)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct sag.organization_id), '{}')
  from public.support_access_grants sag
  where sag.granted_to_user_id = (select auth.uid())
    and sag.revoked_at is null
    and sag.expires_at > now()
    -- PERSONAL implies OPERATIONAL. Asking for the smaller scope must not
    -- exclude someone who was given the larger one.
    and (sag.scope = p_scope or sag.scope = 'PERSONAL');
$$;

revoke all on function app.support_org_ids(support_access_scope) from public;
grant execute on function app.support_org_ids(support_access_scope) to authenticated;

-- A grant is only meaningful for someone the platform actually employs. Without
-- this, a revoked platform administrator would keep whatever grants they held.
create or replace function app.support_org_ids_checked(p_scope support_access_scope)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when app.is_platform_admin() then app.support_org_ids(p_scope)
    else '{}'::uuid[]
  end;
$$;

revoke all on function app.support_org_ids_checked(support_access_scope) from public;
grant execute on function app.support_org_ids_checked(support_access_scope) to authenticated;

-- --- Operational tables ---------------------------------------------------
drop policy rides_select on rides;
create policy rides_select on rides for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('rides.view'))::uuid[])
  or driver_id = any ((select app.driver_ids())::uuid[])
  or client_id = any ((select app.portal_client_ids())::uuid[])
  or organization_id = any ((select app.support_org_ids_checked('OPERATIONAL'))::uuid[])
);

drop policy ride_events_select on ride_events;
create policy ride_events_select on ride_events for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('rides.view'))::uuid[])
  or organization_id = any ((select app.support_org_ids_checked('OPERATIONAL'))::uuid[])
  or exists (
    select 1 from rides r
    where r.id = ride_events.ride_id
      and (
        r.driver_id = any ((select app.driver_ids())::uuid[])
        or r.client_id = any ((select app.portal_client_ids())::uuid[])
      )
  )
);

drop policy locations_select on locations;
create policy locations_select on locations for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('locations.view'))::uuid[])
  or organization_id = any ((select app.support_org_ids_checked('OPERATIONAL'))::uuid[])
  or exists (
    select 1 from rides r
    where (r.pickup_location_id = locations.id or r.destination_location_id = locations.id)
      and (
        r.driver_id = any ((select app.driver_ids())::uuid[])
        or r.client_id = any ((select app.portal_client_ids())::uuid[])
      )
  )
);

drop policy organization_settings_select on organization_settings;
create policy organization_settings_select on organization_settings for select to authenticated
using (
  organization_id = any ((select app.member_org_ids())::uuid[])
  or organization_id = any ((select app.support_org_ids_checked('OPERATIONAL'))::uuid[])
);

-- The fleet. Names of employees, which is why it sits at OPERATIONAL rather
-- than being free: a support engineer reading "who drove this" is proportionate
-- to the ticket they are answering.
drop policy drivers_select on drivers;
create policy drivers_select on drivers for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('drivers.view'))::uuid[])
  or user_id = (select auth.uid())
  or organization_id = any ((select app.support_org_ids_checked('OPERATIONAL'))::uuid[])
);

drop policy vehicles_select on vehicles;
create policy vehicles_select on vehicles for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('vehicles.view'))::uuid[])
  -- A driver needs the vehicle on their own ride, nothing more. This clause is
  -- carried over verbatim from migration 0011; dropping and recreating a policy
  -- to add one line is how the other lines quietly disappear.
  or exists (
    select 1 from rides r
    where r.vehicle_id = vehicles.id
      and r.driver_id = any ((select app.driver_ids())::uuid[])
  )
  or organization_id = any ((select app.support_org_ids_checked('OPERATIONAL'))::uuid[])
);

-- --- Personal tables ------------------------------------------------------
drop policy clients_select on clients;
create policy clients_select on clients for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('clients.view'))::uuid[])
  or id = any ((select app.visible_client_ids())::uuid[])
  or organization_id = any ((select app.support_org_ids_checked('PERSONAL'))::uuid[])
);

drop policy contacts_select on contacts;
create policy contacts_select on contacts for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('contacts.view'))::uuid[])
  or user_id = (select auth.uid())
  or organization_id = any ((select app.support_org_ids_checked('PERSONAL'))::uuid[])
);

-- --- The trail ------------------------------------------------------------
--
-- A support engineer can read the audit log of the organisation that let them
-- in, including their own reads of it. That is the point: the tenant can see
-- what support did, and support can see that the tenant can see it.
drop policy audit_logs_select on audit_logs;
create policy audit_logs_select on audit_logs for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('audit.view'))::uuid[])
  or organization_id = any ((select app.support_org_ids_checked('OPERATIONAL'))::uuid[])
);
