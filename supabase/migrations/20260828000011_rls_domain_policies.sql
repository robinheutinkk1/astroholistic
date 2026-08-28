-- ---------------------------------------------------------------------------
-- 0011 — Policies for the operational tables.
--
-- Same conventions as 0010, including the `::uuid[]` cast on every helper call.
--
-- The interesting part is the SELECT policies on `clients` and `rides`: they
-- carry four different principals at once — staff, drivers, portal clients,
-- parents and care organisations — each scoped by an explicit relation rather
-- than by an absent filter.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- Clients and relations
-- ===========================================================================

create policy clients_select on clients for select to authenticated
using (
  -- Staff with the permission, organisation-wide.
  organization_id = any ((select app.permitted_org_ids('clients.view'))::uuid[])
  -- Everyone else only through an explicit link: the client themselves, a
  -- linked contact, an authorised care organisation, or a driver with an
  -- assigned ride inside the visibility window (decision D-11).
  or id = any ((select app.visible_client_ids())::uuid[])
);

create policy clients_insert on clients for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('clients.create'))::uuid[]));

create policy clients_update on clients for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('clients.update'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('clients.update'))::uuid[]));

create policy clients_delete on clients for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('clients.delete'))::uuid[]));

create policy contacts_select on contacts for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('contacts.view'))::uuid[])
  or user_id = (select auth.uid())
);

create policy contacts_insert on contacts for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('contacts.manage'))::uuid[]));

create policy contacts_update on contacts for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('contacts.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('contacts.manage'))::uuid[]));

create policy contacts_delete on contacts for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('contacts.manage'))::uuid[]));

create policy client_contacts_select on client_contacts for select to authenticated
using (
  exists (
    select 1 from clients c
    where c.id = client_contacts.client_id
      and c.organization_id = any ((select app.permitted_org_ids('contacts.view'))::uuid[])
  )
  or client_id = any ((select app.contact_client_ids())::uuid[])
);

create policy client_contacts_insert on client_contacts for insert to authenticated
with check (
  exists (
    select 1 from clients c
    where c.id = client_contacts.client_id
      and c.organization_id = any ((select app.permitted_org_ids('contacts.manage'))::uuid[])
  )
);

create policy client_contacts_update on client_contacts for update to authenticated
using (
  exists (
    select 1 from clients c
    where c.id = client_contacts.client_id
      and c.organization_id = any ((select app.permitted_org_ids('contacts.manage'))::uuid[])
  )
)
with check (
  exists (
    select 1 from clients c
    where c.id = client_contacts.client_id
      and c.organization_id = any ((select app.permitted_org_ids('contacts.manage'))::uuid[])
  )
);

create policy client_contacts_delete on client_contacts for delete to authenticated
using (
  exists (
    select 1 from clients c
    where c.id = client_contacts.client_id
      and c.organization_id = any ((select app.permitted_org_ids('contacts.manage'))::uuid[])
  )
);

create policy care_organizations_select on care_organizations for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('care_organizations.view'))::uuid[])
  or exists (
    select 1 from care_organization_users cou
    where cou.care_organization_id = care_organizations.id
      and cou.user_id = (select auth.uid())
      and cou.status = 'ACTIVE'
  )
);

create policy care_organizations_insert on care_organizations for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('care_organizations.manage'))::uuid[]));

create policy care_organizations_update on care_organizations for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('care_organizations.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('care_organizations.manage'))::uuid[]));

create policy care_organizations_delete on care_organizations for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('care_organizations.manage'))::uuid[]));

create policy care_organization_users_select on care_organization_users for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from care_organizations co
    where co.id = care_organization_users.care_organization_id
      and co.organization_id = any ((select app.permitted_org_ids('care_organizations.view'))::uuid[])
  )
);

create policy care_organization_users_write on care_organization_users for insert to authenticated
with check (
  exists (
    select 1 from care_organizations co
    where co.id = care_organization_users.care_organization_id
      and co.organization_id = any ((select app.permitted_org_ids('care_organizations.manage'))::uuid[])
  )
);

create policy care_organization_users_delete on care_organization_users for delete to authenticated
using (
  exists (
    select 1 from care_organizations co
    where co.id = care_organization_users.care_organization_id
      and co.organization_id = any ((select app.permitted_org_ids('care_organizations.manage'))::uuid[])
  )
);

create policy client_care_organizations_select on client_care_organizations for select to authenticated
using (
  exists (
    select 1 from clients c
    where c.id = client_care_organizations.client_id
      and c.organization_id = any ((select app.permitted_org_ids('care_organizations.view'))::uuid[])
  )
  or client_id = any ((select app.care_org_client_ids())::uuid[])
);

create policy client_care_organizations_insert on client_care_organizations for insert to authenticated
with check (
  exists (
    select 1 from clients c
    where c.id = client_care_organizations.client_id
      and c.organization_id = any ((select app.permitted_org_ids('care_organizations.manage'))::uuid[])
  )
);

create policy client_care_organizations_delete on client_care_organizations for delete to authenticated
using (
  exists (
    select 1 from clients c
    where c.id = client_care_organizations.client_id
      and c.organization_id = any ((select app.permitted_org_ids('care_organizations.manage'))::uuid[])
  )
);


-- ===========================================================================
-- Fleet and locations
-- ===========================================================================

create policy drivers_select on drivers for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('drivers.view'))::uuid[])
  -- A driver can always see their own record.
  or user_id = (select auth.uid())
);

create policy drivers_insert on drivers for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('drivers.manage'))::uuid[]));

create policy drivers_update on drivers for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('drivers.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('drivers.manage'))::uuid[]));

create policy drivers_delete on drivers for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('drivers.manage'))::uuid[]));

create policy vehicles_select on vehicles for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('vehicles.view'))::uuid[])
  -- A driver needs the vehicle on their own ride, nothing more.
  or exists (
    select 1 from rides r
    where r.vehicle_id = vehicles.id
      and r.driver_id = any ((select app.driver_ids())::uuid[])
  )
);

create policy vehicles_insert on vehicles for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('vehicles.manage'))::uuid[]));

create policy vehicles_update on vehicles for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('vehicles.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('vehicles.manage'))::uuid[]));

create policy vehicles_delete on vehicles for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('vehicles.manage'))::uuid[]));

create policy driver_vehicles_select on driver_vehicles for select to authenticated
using (
  exists (
    select 1 from drivers d
    where d.id = driver_vehicles.driver_id
      and (
        d.organization_id = any ((select app.permitted_org_ids('drivers.view'))::uuid[])
        or d.user_id = (select auth.uid())
      )
  )
);

create policy driver_vehicles_insert on driver_vehicles for insert to authenticated
with check (
  exists (
    select 1 from drivers d
    where d.id = driver_vehicles.driver_id
      and d.organization_id = any ((select app.permitted_org_ids('drivers.manage'))::uuid[])
  )
);

create policy driver_vehicles_delete on driver_vehicles for delete to authenticated
using (
  exists (
    select 1 from drivers d
    where d.id = driver_vehicles.driver_id
      and d.organization_id = any ((select app.permitted_org_ids('drivers.manage'))::uuid[])
  )
);

create policy locations_select on locations for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('locations.view'))::uuid[])
  -- Pickup and destination of a ride the caller is allowed to see. Not a
  -- browsable list — that would hand a driver every address in the tenant.
  or exists (
    select 1 from rides r
    where (r.pickup_location_id = locations.id or r.destination_location_id = locations.id)
      and (
        r.driver_id = any ((select app.driver_ids())::uuid[])
        or r.client_id = any ((select app.visible_client_ids())::uuid[])
      )
  )
);

create policy locations_insert on locations for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('locations.manage'))::uuid[]));

create policy locations_update on locations for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('locations.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('locations.manage'))::uuid[]));

create policy locations_delete on locations for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('locations.manage'))::uuid[]));
