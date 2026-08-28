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

-- Supabase grants the service role full table access through default
-- privileges at project creation; the migrations therefore never grant to it
-- and simply assume it. Without this the verification-write path — the one
-- place the application deliberately steps outside RLS — would be untestable
-- here for the wrong reason.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Stand-in for auth.users.
--
-- Columns mirror the subset the seed writes, so ONE seed file works against
-- both this shim and a real Supabase project. If the two diverged, the seed
-- would be untested on the path that actually matters.
create table if not exists auth.users (
  instance_id uuid default '00000000-0000-0000-0000-000000000000',
  id uuid primary key default gen_random_uuid(),
  aud varchar(255) default 'authenticated',
  role varchar(255) default 'authenticated',
  email citext unique,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

-- --- Storage -------------------------------------------------------------
-- Supabase Storage keeps its metadata in ordinary PostgreSQL tables and
-- enforces access with RLS on storage.objects, exactly like any other table.
-- Migration 0021 writes policies against those tables, so the local database
-- needs them or the migration set is not reproducible here (§40).
--
-- Only the columns the migrations and the security suite touch are mirrored.
-- The bytes themselves live in object storage, which has no local equivalent;
-- uploads therefore cannot be exercised here (docs/DEVELOPMENT.md).
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  public boolean not null default false,
  avif_autodetection boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.objects to anon;
grant select on storage.buckets to anon, authenticated;
grant insert, update, delete on storage.buckets to service_role;
