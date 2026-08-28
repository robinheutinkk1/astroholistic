-- ---------------------------------------------------------------------------
-- 0025 — Fix: infinite recursion between two policies.
--
-- THE BUG. `care_organizations_select` (migration 0011) tested membership with
-- an EXISTS over `care_organization_users`. That table's own policy tests the
-- reverse, with an EXISTS over `care_organizations`. Each policy therefore
-- triggered the other, and PostgreSQL refused the query outright:
--
--   ERROR: infinite recursion detected in policy for relation "care_organizations"
--
-- WHY IT WAS NOT NOTICED. The first branch of the policy short-circuits: a
-- planner holds `care_organizations.view`, the `or` never reaches the EXISTS,
-- and the query works. It only recurses for a caller who does *not* hold the
-- permission — that is, a care-organisation portal user, the one group the
-- second branch exists for. Their portal screens happened to reach the data
-- through `app.care_org_client_ids()`, which is SECURITY DEFINER and so never
-- evaluated the policy at all. The defect sat between the two paths where
-- nothing looked.
--
-- Found while adding the GDPR export in 0026, which joins `care_organizations`
-- as an ordinary table for the first time.
--
-- THE FIX. Break the cycle the way every other cross-table rule in this schema
-- already does: answer "which care organisations am I in?" with a SECURITY
-- DEFINER helper, whose own query does not evaluate policies.
-- ---------------------------------------------------------------------------

create or replace function app.care_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct cou.care_organization_id), '{}')
  from public.care_organization_users cou
  where cou.user_id = (select auth.uid())
    and cou.status = 'ACTIVE';
$$;

revoke all on function app.care_org_ids() from public;
grant execute on function app.care_org_ids() to authenticated;

drop policy care_organizations_select on care_organizations;

create policy care_organizations_select on care_organizations for select to authenticated
using (
  organization_id = any ((select app.permitted_org_ids('care_organizations.view'))::uuid[])
  -- Was an EXISTS over care_organization_users, which recursed. Same rule,
  -- resolved outside the policy system.
  or id = any ((select app.care_org_ids())::uuid[])
);
