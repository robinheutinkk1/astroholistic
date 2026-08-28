-- ---------------------------------------------------------------------------
-- 0010 — Row Level Security policies. This is the security boundary.
--
-- Conventions, enforced in review:
--
--   1. Every helper call is wrapped as `(select app.fn(...))::uuid[]` so
--      Postgres hoists it into a once-per-statement InitPlan. The cast is not
--      cosmetic: without it, `= any ((select ...))` parses as the SUBQUERY form
--      of ANY and Postgres tries to compare uuid to uuid[]. The cast forces the
--      scalar-subquery-returning-an-array reading.
--   2. Policies are written per command. `for all` hides gaps.
--   3. Every INSERT and UPDATE policy has a WITH CHECK clause. A USING clause
--      alone still permits writing a row INTO another tenant.
--   4. Nothing is granted to `anon`.
-- ---------------------------------------------------------------------------

-- Table privileges. RLS filters rows; grants decide whether the role may touch
-- the table at all. Both are needed.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Append-only tables: layer 2 of 3 (docs/DATABASE.md §9).
revoke update, delete on ride_events from authenticated;
revoke update, delete on audit_logs from authenticated;
-- Reference data nobody edits at runtime.
revoke insert, update, delete on permissions from authenticated;


-- ===========================================================================
-- Tenancy
-- ===========================================================================

create policy organizations_select on organizations for select to authenticated
using (
  id = any ((select app.member_org_ids())::uuid[])
  or (select app.is_platform_admin())
  or id = any ((select app.support_org_ids())::uuid[])
);

create policy organizations_update on organizations for update to authenticated
using (id = any ((select app.permitted_org_ids('organization.manage'))::uuid[]))
with check (id = any ((select app.permitted_org_ids('organization.manage'))::uuid[]));

-- No INSERT or DELETE policy: organisations are created and removed by the
-- platform through a service-role path, never by a tenant.

create policy organization_settings_select on organization_settings for select to authenticated
using (organization_id = any ((select app.member_org_ids())::uuid[]));

create policy organization_settings_update on organization_settings for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('organization.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('organization.manage'))::uuid[]));

create policy organization_branding_select on organization_branding for select to authenticated
using (organization_id = any ((select app.member_org_ids())::uuid[]));

create policy organization_branding_update on organization_branding for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('branding.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('branding.manage'))::uuid[]));

create policy organization_domains_select on organization_domains for select to authenticated
using (organization_id = any ((select app.member_org_ids())::uuid[]));

create policy organization_domains_insert on organization_domains for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('domain.manage'))::uuid[]));

create policy organization_domains_update on organization_domains for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('domain.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('domain.manage'))::uuid[]));

create policy organization_domains_delete on organization_domains for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('domain.manage'))::uuid[]));

-- Plan catalogue carries no personal data and is readable by any signed-in user.
create policy plans_select on plans for select to authenticated using (true);

create policy subscriptions_select on subscriptions for select to authenticated
using (
  organization_id = any ((select app.member_org_ids())::uuid[])
  or (select app.is_platform_admin())
);

create policy usage_metrics_select on usage_metrics for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('reports.view'))::uuid[])
  or (select app.is_platform_admin())
);


-- ===========================================================================
-- Identity and RBAC
-- ===========================================================================

-- A user sees their own profile, and the profiles of people they share an
-- organisation with (needed to render "assigned by", "driven by"). Not the
-- whole user table.
create policy profiles_select on profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1 from organization_users ou
    where ou.user_id = profiles.id
      and ou.organization_id = any ((select app.member_org_ids())::uuid[])
  )
);

create policy profiles_update_self on profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Platform admin membership is visible only to platform admins, and only they
-- can extend it. There is no self-insert path.
create policy platform_admins_select on platform_admins for select to authenticated
using ((select app.is_platform_admin()));

create policy platform_admins_insert on platform_admins for insert to authenticated
with check ((select app.is_platform_admin()));

create policy platform_admins_delete on platform_admins for delete to authenticated
using ((select app.is_platform_admin()));

create policy organization_users_select on organization_users for select to authenticated
using (
  user_id = (select auth.uid())
  or organization_id = any ((select app.permitted_org_ids('organization.members.view'))::uuid[])
);

create policy organization_users_insert on organization_users for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('organization.members.manage'))::uuid[]));

create policy organization_users_update on organization_users for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('organization.members.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('organization.members.manage'))::uuid[]));

create policy organization_users_delete on organization_users for delete to authenticated
using (organization_id = any ((select app.permitted_org_ids('organization.members.manage'))::uuid[]));

create policy roles_select on roles for select to authenticated
using (
  is_system
  or organization_id = any ((select app.member_org_ids())::uuid[])
);

-- System roles are templates shared by every tenant, so a tenant may never
-- write one: `organization_id is not null` is the guard.
create policy roles_insert on roles for insert to authenticated
with check (
  organization_id is not null
  and organization_id = any ((select app.permitted_org_ids('organization.roles.manage'))::uuid[])
);

create policy roles_update on roles for update to authenticated
using (
  organization_id is not null
  and organization_id = any ((select app.permitted_org_ids('organization.roles.manage'))::uuid[])
)
with check (
  organization_id is not null
  and organization_id = any ((select app.permitted_org_ids('organization.roles.manage'))::uuid[])
);

create policy roles_delete on roles for delete to authenticated
using (
  organization_id is not null
  and organization_id = any ((select app.permitted_org_ids('organization.roles.manage'))::uuid[])
);

create policy permissions_select on permissions for select to authenticated using (true);

create policy role_permissions_select on role_permissions for select to authenticated
using (
  exists (
    select 1 from roles r
    where r.id = role_permissions.role_id
      and (r.is_system or r.organization_id = any ((select app.member_org_ids())::uuid[]))
  )
);

create policy role_permissions_insert on role_permissions for insert to authenticated
with check (
  exists (
    select 1 from roles r
    where r.id = role_permissions.role_id
      and r.organization_id is not null
      and r.organization_id = any ((select app.permitted_org_ids('organization.roles.manage'))::uuid[])
  )
);

create policy role_permissions_delete on role_permissions for delete to authenticated
using (
  exists (
    select 1 from roles r
    where r.id = role_permissions.role_id
      and r.organization_id is not null
      and r.organization_id = any ((select app.permitted_org_ids('organization.roles.manage'))::uuid[])
  )
);

create policy organization_user_roles_select on organization_user_roles for select to authenticated
using (
  exists (
    select 1 from organization_users ou
    where ou.id = organization_user_roles.organization_user_id
      and (
        ou.user_id = (select auth.uid())
        or ou.organization_id = any ((select app.permitted_org_ids('organization.members.view'))::uuid[])
      )
  )
);

create policy organization_user_roles_insert on organization_user_roles for insert to authenticated
with check (
  exists (
    select 1 from organization_users ou
    where ou.id = organization_user_roles.organization_user_id
      and ou.organization_id = any ((select app.permitted_org_ids('organization.roles.manage'))::uuid[])
      -- You cannot change your own roles (docs/ROLES_AND_PERMISSIONS.md §8.2).
      and ou.user_id <> (select auth.uid())
  )
);

create policy organization_user_roles_delete on organization_user_roles for delete to authenticated
using (
  exists (
    select 1 from organization_users ou
    where ou.id = organization_user_roles.organization_user_id
      and ou.organization_id = any ((select app.permitted_org_ids('organization.roles.manage'))::uuid[])
      and ou.user_id <> (select auth.uid())
  )
);

create policy support_access_grants_select on support_access_grants for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('organization.manage'))::uuid[])
  or granted_to_user_id = (select auth.uid())
);

create policy support_access_grants_insert on support_access_grants for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('organization.manage'))::uuid[]));

create policy support_access_grants_update on support_access_grants for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('organization.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('organization.manage'))::uuid[]));
