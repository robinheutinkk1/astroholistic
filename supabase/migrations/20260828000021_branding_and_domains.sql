-- ---------------------------------------------------------------------------
-- 0021 — White label: logo storage, tamper-proof branding paths, domains.
--
-- Three problems this migration solves, all of them security problems rather
-- than feature gaps:
--
-- 1. `logo_url` was free text. A tenant administrator holds `branding.manage`,
--    so RLS lets them write that column — and PostgREST is reachable with
--    their own token, so "the form does not offer that field" is not a
--    control. A free-text URL rendered into <img src> on a portal page that
--    parents of *other* people visit is a tracking pixel at best and an
--    injection vector at worst. The column is replaced by a path that a CHECK
--    constraint forces to live under the organisation's own prefix, and the
--    URL is assembled in code. The database, not the form, is the guarantee.
--
-- 2. Logos need somewhere to live. The bucket is public-read (a company logo
--    is a public thing and is shown to signed-out visitors on a tenant's own
--    login page) but writes are restricted by RLS to `branding.manage` holders
--    writing inside their own organisation's folder.
--
-- 3. A globally unique hostname let any organisation squat on a competitor's
--    domain by simply typing it: the row stays PENDING forever, and the real
--    owner can never add it. Uniqueness now applies only once a domain is
--    VERIFIED, which is the point at which ownership has actually been proven.
-- ---------------------------------------------------------------------------

-- --- 0. Text-shaped permission helper -------------------------------------
-- storage.objects.name is text, and its first segment is the organisation id.
-- Comparing text to text keeps the tenant check total: a malformed folder name
-- simply fails to match, where a ::uuid cast would raise and turn a denied
-- upload into a 500. Same InitPlan calling convention as its uuid sibling:
-- `= any ((select fn())::text[])`. The cast is not decoration — without it
-- PostgreSQL reads `= any (subquery)` as the row form and fails with
-- "operator does not exist: text = text[]" (docs/ARCHITECTURE.md §9).
create or replace function app.permitted_org_id_texts(p_permission text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(o::text), '{}')
  from unnest(app.permitted_org_ids(p_permission)) o;
$$;

revoke all on function app.permitted_org_id_texts(text) from public;
grant execute on function app.permitted_org_id_texts(text) to authenticated;

-- --- 1. Logo storage ------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  true,
  524288, -- keep in sync with MAX_LOGO_BYTES in src/features/branding/image.ts
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Anonymous read is what makes a tenant's logo renderable on their public
-- login and check-in pages. The bucket holds logos only; nothing personal.
create policy organization_logos_read on storage.objects for select
to anon, authenticated
using (bucket_id = 'organization-logos');

-- The folder name is the organisation id, so `split_part(name, '/', 1)`
-- is the tenant boundary. Writing outside your own folder is not expressible.
create policy organization_logos_insert on storage.objects for insert
to authenticated
with check (
  bucket_id = 'organization-logos'
  and split_part(name, '/', 1) = any (
    (select app.permitted_org_id_texts('branding.manage'))::text[]
  )
);

create policy organization_logos_update on storage.objects for update
to authenticated
using (
  bucket_id = 'organization-logos'
  and split_part(name, '/', 1) = any (
    (select app.permitted_org_id_texts('branding.manage'))::text[]
  )
)
with check (
  bucket_id = 'organization-logos'
  and split_part(name, '/', 1) = any (
    (select app.permitted_org_id_texts('branding.manage'))::text[]
  )
);

create policy organization_logos_delete on storage.objects for delete
to authenticated
using (
  bucket_id = 'organization-logos'
  and split_part(name, '/', 1) = any (
    (select app.permitted_org_id_texts('branding.manage'))::text[]
  )
);

-- --- 2. Branding stores paths, not URLs -----------------------------------
alter table organization_branding drop column logo_url;
alter table organization_branding drop column favicon_url;

alter table organization_branding
  add column logo_path text,
  add column favicon_path text;

-- The path is pinned to exactly what the upload code produces: the row's own
-- organisation id, one slash, one known filename.
--
-- A prefix test alone is not enough, and that is worth spelling out. The path
-- is pasted into a URL, and a browser resolves `..` before sending the request
-- — so `<own id>/../<other id>/logo.png` *starts with* the right prefix and
-- still points somewhere else entirely, potentially outside the bucket. An
-- exact pattern has no such gap.
alter table organization_branding
  add constraint branding_logo_path_scoped
    check (
      logo_path is null
      or logo_path ~ ('^' || organization_id::text || '/logo\.(png|jpeg|webp)$')
    ),
  add constraint branding_favicon_path_scoped
    check (
      favicon_path is null
      or favicon_path ~ ('^' || organization_id::text || '/favicon\.(png|jpeg|webp)$')
    );

-- Every organisation should have a branding row, but a row can be missing (an
-- organisation created before this table, a failed provisioning step). Without
-- an INSERT policy the settings screen would then be permanently unusable and
-- the only fix would be a service-role hand-edit. Same permission as UPDATE.
create policy organization_branding_insert on organization_branding for insert
to authenticated
with check (
  organization_id = any ((select app.permitted_org_ids('branding.manage'))::uuid[])
);

-- --- 3. Domain uniqueness only after ownership is proven ------------------
alter table organization_domains drop constraint organization_domains_hostname_key;

-- One organisation still cannot list the same hostname twice.
create unique index organization_domains_org_hostname
  on organization_domains (organization_id, hostname);

-- Two organisations cannot both have it *verified*. The loser of the race gets
-- a unique violation at verification time, which is the correct moment: it is
-- the first point where either party has demonstrated control of the DNS.
create unique index organization_domains_verified_hostname
  on organization_domains (hostname)
  where verification_status = 'VERIFIED';

-- A token must exist the moment the row does, otherwise the tenant is shown an
-- empty DNS record to publish.
alter table organization_domains
  alter column verification_token set default encode(gen_random_bytes(16), 'hex');

update organization_domains
set verification_token = encode(gen_random_bytes(16), 'hex')
where verification_token is null;

alter table organization_domains
  alter column verification_token set not null;

-- Verification is proven by the server, never asserted by the client. A tenant
-- may create and delete their own rows, but flipping the status is done by the
-- verification path with the service role. Blocking it here means a crafted
-- PostgREST call cannot simply set VERIFIED on someone else's hostname.
create or replace function app.guard_domain_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status
     or new.verified_at is distinct from old.verified_at
     or new.verification_token is distinct from old.verification_token then
    raise exception 'domain verification is set by the server, not by the client'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger organization_domains_guard_verification
  before update on organization_domains
  for each row execute function app.guard_domain_verification();

-- --- 4. Branding for an anonymous visitor on a tenant domain --------------
--
-- A parent opening https://vervoer.example.nl must see that company's name and
-- colours *before* signing in, so this has to answer for `anon`. It is
-- SECURITY DEFINER because organization_branding is members-only, and it
-- returns strictly the four things a visitor already sees painted on the page:
-- name, logo, two colours. No support address, no id list, no domain
-- inventory. Feeding it an unknown host returns nothing, so it cannot be used
-- to enumerate which domains the platform serves beyond what a DNS lookup
-- already tells you.
create or replace function public.branding_for_host(p_host text)
returns table (
  display_name text,
  logo_path text,
  primary_color text,
  secondary_color text,
  hide_platform_branding boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (
    select lower(btrim(rtrim(split_part(coalesce(p_host, ''), ':', 1), '.'))) as host
  ),
  candidates as (
    select host from normalized
    union all
    -- www.example.nl falls back to example.nl. The same DNS owner proved both,
    -- so this is a convenience, not a widening of trust.
    select regexp_replace(host, '^www\.', '') from normalized where host like 'www.%'
  ),
  matched as (
    select d.organization_id
    from public.organization_domains d
    join public.organizations o on o.id = d.organization_id
    where d.hostname::text in (select host from candidates)
      and d.verification_status = 'VERIFIED'
      and o.deleted_at is null
      and o.status in ('TRIAL', 'ACTIVE')
    limit 1
  )
  select b.display_name,
         b.logo_path,
         b.primary_color,
         b.secondary_color,
         b.hide_platform_branding
  from public.organization_branding b
  join matched m on m.organization_id = b.organization_id;
$$;

revoke all on function public.branding_for_host(text) from public;
grant execute on function public.branding_for_host(text) to anon, authenticated, service_role;

-- --- 5. A portal user may see the branding of the organisation that
--        transports their child --------------------------------------------
--
-- organization_branding was readable by members only, which is the correct
-- default for a settings table. But white label means a parent opening the
-- portal sees the transport company's name, logo and colours — and a parent is
-- not a member of that organisation. Without this the portal would silently
-- fall back to platform styling for exactly the people white label exists for.
--
-- The scope is the organisations the viewer already reaches clients in, so it
-- grants no organisation they could not already name, and the columns it
-- exposes are the ones printed on the page they are looking at.
create or replace function app.portal_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct c.organization_id), '{}')
  from public.clients c
  where c.id = any (app.portal_client_ids())
    and c.deleted_at is null;
$$;

revoke all on function app.portal_org_ids() from public;
grant execute on function app.portal_org_ids() to authenticated;

drop policy organization_branding_select on organization_branding;

create policy organization_branding_select on organization_branding for select to authenticated
using (
  organization_id = any ((select app.member_org_ids())::uuid[])
  or organization_id = any ((select app.portal_org_ids())::uuid[])
);
