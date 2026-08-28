-- ---------------------------------------------------------------------------
-- 0004 — The functions every RLS policy is built on.
--
-- Three properties matter for all of them:
--
--   security definer  — they read membership tables the caller cannot read
--   stable            — so Postgres may cache within a statement
--   set search_path = '' — otherwise a caller could shadow `public` and make a
--                          security-definer function read their own tables
--
-- CALLING CONVENTION: policies must invoke these as `(select app.fn())`.
-- Postgres then evaluates them once per statement as an InitPlan instead of
-- once per row. Without the parentheses, listing 10 000 rides means 10 000
-- function calls (docs/SECURITY.md §4).
-- ---------------------------------------------------------------------------

-- Organisations the caller is an ACTIVE member of.
--
-- Read live from the table rather than from a JWT claim (decision D-04):
-- a claim stays valid for up to an hour after someone is removed from an
-- organisation, and for a platform holding data about vulnerable people,
-- correct revocation beats a few milliseconds.
create or replace function app.member_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(ou.organization_id), '{}')
  from public.organization_users ou
  join public.organizations o on o.id = ou.organization_id
  where ou.user_id = (select auth.uid())
    and ou.status = 'ACTIVE'
    -- A suspended organisation must actually stop working, not just show a
    -- badge in the interface (docs/DATABASE.md §3).
    and o.status in ('TRIAL', 'ACTIVE')
    and o.deleted_at is null;
$$;

create or replace function app.is_member_of(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_organization_id = any (app.member_org_ids());
$$;

-- Effective permissions of the caller, as (organization_id, permission_key).
create or replace function app.member_permissions()
returns table (organization_id uuid, permission_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct ou.organization_id, rp.permission_key
  from public.organization_users ou
  join public.organizations o on o.id = ou.organization_id
  join public.organization_user_roles our on our.organization_user_id = ou.id
  join public.role_permissions rp on rp.role_id = our.role_id
  where ou.user_id = (select auth.uid())
    and ou.status = 'ACTIVE'
    and o.status in ('TRIAL', 'ACTIVE')
    and o.deleted_at is null;
$$;

create or replace function app.has_permission(p_organization_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app.member_permissions() mp
    where mp.organization_id = p_organization_id
      and mp.permission_key = p_permission
  );
$$;

-- Platform administrators. Note what this does NOT grant: no policy on
-- clients, rides, ride_events or tags consults it (decision D-02).
create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  );
$$;

-- Organisations where the caller currently holds a live, tenant-granted
-- support window. Empty for everyone, almost always.
create or replace function app.support_org_ids()
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
    and sag.expires_at > now();
$$;

-- The driver record belonging to the caller, if any.
create or replace function app.driver_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(d.id), '{}')
  from public.drivers d
  where d.user_id = (select auth.uid())
    and d.deleted_at is null;
$$;

-- Clients the caller may see as a CONTACT (parent/guardian), via an explicit
-- link that carries its own permission flag.
create or replace function app.contact_client_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct cc.client_id), '{}')
  from public.client_contacts cc
  join public.contacts c on c.id = cc.contact_id
  where c.user_id = (select auth.uid())
    and cc.can_view_rides;
$$;

-- Clients the caller may see as a CARE ORGANISATION, honouring the validity
-- window so a funder loses access when the arrangement ends.
create or replace function app.care_org_client_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct cco.client_id), '{}')
  from public.client_care_organizations cco
  join public.care_organization_users cou
    on cou.care_organization_id = cco.care_organization_id
  where cou.user_id = (select auth.uid())
    and cou.status = 'ACTIVE'
    and cco.valid_from <= current_date
    and (cco.valid_to is null or cco.valid_to >= current_date);
$$;

-- The client record belonging to the caller, if they have a client portal login.
create or replace function app.self_client_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(c.id), '{}')
  from public.clients c
  where c.user_id = (select auth.uid())
    and c.deleted_at is null;
$$;

-- Clients a driver may see: only those on a ride assigned to them, inside the
-- organisation's visibility window (decision D-11). A driver who did one ride
-- last year must not be able to look up that person's address forever.
create or replace function app.driver_visible_client_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct r.client_id), '{}')
  from public.rides r
  join public.drivers d on d.id = r.driver_id
  join public.organization_settings s on s.organization_id = r.organization_id
  where d.user_id = (select auth.uid())
    and r.scheduled_date between (current_date - 1)
                             and (current_date + s.driver_client_visibility_days);
$$;

-- Every client the caller may see, from whichever direction.
create or replace function app.visible_client_ids()
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
      || app.driver_visible_client_ids()
    )
  );
$$;

revoke all on function
  app.member_org_ids(), app.is_member_of(uuid), app.member_permissions(),
  app.has_permission(uuid, text), app.is_platform_admin(), app.support_org_ids(),
  app.driver_ids(), app.contact_client_ids(), app.care_org_client_ids(),
  app.self_client_ids(), app.driver_visible_client_ids(), app.visible_client_ids()
from public;

grant execute on function
  app.member_org_ids(), app.is_member_of(uuid), app.member_permissions(),
  app.has_permission(uuid, text), app.is_platform_admin(), app.support_org_ids(),
  app.driver_ids(), app.contact_client_ids(), app.care_org_client_ids(),
  app.self_client_ids(), app.driver_visible_client_ids(), app.visible_client_ids()
to authenticated;

-- ---------------------------------------------------------------------------
-- The workhorse of the policy layer.
--
-- Returns the organisations where the caller holds a given permission. Because
-- the argument is a constant (a literal permission key in the policy) rather
-- than a column, Postgres can evaluate `(select app.permitted_org_ids('x'))`
-- once per statement as an InitPlan.
--
-- Compare with the naive alternative, `app.has_permission(organization_id, 'x')`:
-- that takes a column, so it cannot be hoisted and runs once per row.
-- ---------------------------------------------------------------------------
create or replace function app.permitted_org_ids(p_permission text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct mp.organization_id), '{}')
  from app.member_permissions() mp
  where mp.permission_key = p_permission;
$$;

revoke all on function app.permitted_org_ids(text) from public;
grant execute on function app.permitted_org_ids(text) to authenticated;
