-- ---------------------------------------------------------------------------
-- Local-only bootstrap: recreates the parts of Supabase that migrations assume.
--
-- This is NOT a migration and must never be applied to a Supabase project —
-- Supabase already provides all of this. It exists so the tenant-isolation
-- suite can run against a bare PostgreSQL cluster when Docker (and therefore
-- the Supabase CLI stack) is unavailable.
--
-- The definitions below deliberately mirror Supabase's own: auth.uid() reads
-- the `sub` claim from the request.jwt.claims GUC, exactly as PostgREST sets it.
-- If this shim drifted from Supabase's behaviour the RLS tests would be
-- testing fiction, so keep it minimal and faithful.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Roles PostgREST switches into, based on the JWT `role` claim.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end
$$;

grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Minimal stand-in for auth.users. Only the columns migrations reference.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email citext unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
    'anon'
  )
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
