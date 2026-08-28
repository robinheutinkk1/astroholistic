-- ---------------------------------------------------------------------------
-- 0003 — Accounts, memberships, roles and permissions.
--
-- The core idea (docs/ROLES_AND_PERMISSIONS.md): an account carries no rights
-- of its own. Access exists only where an explicit row links a user to an
-- organisation, a client, or a care organisation. There is no default role.
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext,
  full_name text,
  phone text,
  avatar_url text,
  locale text not null default 'nl-NL',
  status account_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- Deliberately a table rather than a boolean on profiles: RLS can then forbid
-- self-insertion outright, and every grant is an auditable row.
create table platform_admins (
  user_id uuid primary key references profiles (id) on delete cascade,
  granted_by uuid references profiles (id),
  granted_at timestamptz not null default now(),
  note text
);
alter table platform_admins enable row level security;

create table organization_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status membership_status not null default 'INVITED',
  invited_by uuid references profiles (id),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
alter table organization_users enable row level security;
create index organization_users_user_idx on organization_users (user_id, status);
create index organization_users_org_idx on organization_users (organization_id, status);

-- organization_id null = system role template, shared by all tenants and not
-- editable by them. Non-null = a tenant's own custom role.
create table roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id) on delete cascade,
  key citext not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_system_has_no_org check (is_system = (organization_id is null))
);
alter table roles enable row level security;
create unique index roles_key_unique on roles (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

create table permissions (
  key text primary key,
  category text not null,
  description text not null,
  is_assignable boolean not null default true
);
alter table permissions enable row level security;

create table role_permissions (
  role_id uuid not null references roles (id) on delete cascade,
  permission_key text not null references permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);
alter table role_permissions enable row level security;

create table organization_user_roles (
  organization_user_id uuid not null references organization_users (id) on delete cascade,
  role_id uuid not null references roles (id) on delete cascade,
  granted_by uuid references profiles (id),
  granted_at timestamptz not null default now(),
  primary key (organization_user_id, role_id)
);
alter table organization_user_roles enable row level security;

-- Platform support access is granted BY the tenant, time-boxed, and audited
-- (decision D-02). Without a live grant, platform admins see no personal data.
create table support_access_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  granted_to_user_id uuid not null references profiles (id) on delete cascade,
  granted_by_user_id uuid not null references profiles (id),
  reason text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint support_grant_reason_not_blank check (length(btrim(reason)) > 0),
  constraint support_grant_expiry_future check (expires_at > created_at)
);
alter table support_access_grants enable row level security;
create index support_access_grants_lookup
  on support_access_grants (granted_to_user_id, organization_id, expires_at)
  where revoked_at is null;

create trigger profiles_touch before update on profiles
  for each row execute function app.touch_updated_at();
create trigger organization_users_touch before update on organization_users
  for each row execute function app.touch_updated_at();
create trigger roles_touch before update on roles
  for each row execute function app.touch_updated_at();


-- ---------------------------------------------------------------------------
-- Escalation guards (docs/ROLES_AND_PERMISSIONS.md §8).
--
-- These are triggers rather than policies because they compare the row being
-- written against other rows — something a WITH CHECK expression cannot express
-- cleanly.
-- ---------------------------------------------------------------------------

-- Guard 1: a role must be a system role or belong to the same organisation as
-- the membership. Without this, organisation A can assign a role defined by
-- organisation B — cross-tenant role injection (threat T7).
create or replace function app.enforce_role_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_org uuid;
  v_role_org uuid;
  v_role_is_system boolean;
begin
  select organization_id into v_membership_org
  from public.organization_users where id = new.organization_user_id;

  select organization_id, is_system into v_role_org, v_role_is_system
  from public.roles where id = new.role_id;

  if v_role_is_system then
    return new;
  end if;

  if v_role_org is distinct from v_membership_org then
    raise exception
      'Role % does not belong to organisation % (cross-tenant role assignment)',
      new.role_id, v_membership_org
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger organization_user_roles_tenant_match
  before insert or update on organization_user_roles
  for each row execute function app.enforce_role_tenant_match();

-- Guard 2: an organisation must always keep at least one active owner, so a
-- tenant cannot lock itself out (or be locked out by a disgruntled admin).
create or replace function app.enforce_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_remaining integer;
begin
  select ou.organization_id into v_org
  from public.organization_users ou
  where ou.id = coalesce(old.organization_user_id, new.organization_user_id);

  if v_org is null then
    return coalesce(new, old);
  end if;

  select count(*) into v_remaining
  from public.organization_user_roles our
  join public.organization_users ou on ou.id = our.organization_user_id
  join public.roles r on r.id = our.role_id
  where ou.organization_id = v_org
    and ou.status = 'ACTIVE'
    and r.key = 'owner';

  if v_remaining = 0 then
    raise exception 'An organisation must keep at least one active owner'
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create constraint trigger organization_user_roles_last_owner
  after delete or update on organization_user_roles
  deferrable initially deferred
  for each row execute function app.enforce_last_owner();
