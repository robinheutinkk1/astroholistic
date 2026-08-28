-- ---------------------------------------------------------------------------
-- 0025 — Data-subject rights and retention (§8, docs/SECURITY.md §9).
--
-- ERASURE ANONYMISES, IT DOES NOT DELETE. Deleting a client would take the
-- rides with it, and those rides are the transport administration: the record
-- of who was driven where, which an organisation is required to keep and which
-- the audit trail refers to. So the person is removed from the record while the
-- record survives — names, contact details and address blanked, `anonymized_at`
-- set, the portal login detached (docs/DATABASE.md §10).
--
-- Be honest about the limit of that: a ride still points at a client row, and
-- somebody with an old export could match the two up. Anonymisation here means
-- "this system can no longer say who this was", not "this event never
-- happened".
--
-- RETENTION USES THE SAME PATH. A retention sweep is not a second, weaker kind
-- of erasure — it is the same function on a timer. One implementation means one
-- place where "what does erased mean" is decided.
-- ---------------------------------------------------------------------------

create table retention_policies (
  organization_id uuid primary key references organizations (id) on delete cascade,
  -- After this many months without a ride, a client is anonymised. Default two
  -- years: long enough that a pupil returning after a gap year is still known,
  -- short enough that a school's leavers do not sit in the system forever.
  inactive_client_months integer not null default 24,
  -- Kept but not enforced by the sweep below: deleting rides is a decision with
  -- fiscal consequences and belongs to the organisation, not to a nightly job.
  ride_retention_months integer not null default 84,
  -- Off by default. An organisation switches it on deliberately.
  auto_anonymize_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retention_inactive_range check (inactive_client_months between 6 and 120),
  constraint retention_ride_range check (ride_retention_months between 12 and 240)
);
alter table retention_policies enable row level security;

-- Migration 0010 granted table privileges to `authenticated` with
-- `on all tables in schema public`, which is a snapshot: it covers the tables
-- that existed then and nothing added later. Every table created after that
-- point needs its own grant, or RLS never even gets consulted because the role
-- has no privilege to begin with. The security suite caught this one.
grant select, insert, update, delete on retention_policies to authenticated;

create trigger retention_policies_touch before update on retention_policies
  for each row execute function app.touch_updated_at();

create policy retention_policies_select on retention_policies for select to authenticated
using (organization_id = any ((select app.member_org_ids())::uuid[]));

create policy retention_policies_insert on retention_policies for insert to authenticated
with check (organization_id = any ((select app.permitted_org_ids('organization.manage'))::uuid[]));

create policy retention_policies_update on retention_policies for update to authenticated
using (organization_id = any ((select app.permitted_org_ids('organization.manage'))::uuid[]))
with check (organization_id = any ((select app.permitted_org_ids('organization.manage'))::uuid[]));

-- --- Erasure --------------------------------------------------------------
--
-- SECURITY INVOKER: erasing a client is an ordinary write by someone who holds
-- `clients.delete`, and RLS is what says whether they may touch this row. A
-- SECURITY DEFINER version would work for anyone who could reach the function.
--
-- Returns the detached auth user id, if there was one, so the caller can
-- finish the job outside the database — the login account itself is in
-- `auth.users`, which no tenant may write.
create or replace function public.anonymize_client(
  p_organization_id uuid,
  p_client_id uuid
)
returns table (detached_user_id uuid, contacts_anonymized integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_contacts integer := 0;
  v_updated integer;
begin
  update public.clients c
  set first_name = 'Verwijderd',
      last_name  = 'Cliënt',
      phone = null,
      email = null,
      address_line1 = null,
      postal_code = null,
      city = null,
      external_reference = null,
      user_id = null,
      status = 'INACTIVE',
      anonymized_at = now()
  where c.id = p_client_id
    and c.organization_id = p_organization_id
    and c.anonymized_at is null
  returning c.user_id into v_user_id;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    -- Either the row is not visible to this caller, it belongs to another
    -- organisation, or it was already anonymised. All three are "nothing to
    -- do", and none of them should look different from the outside.
    return;
  end if;

  -- An NFC tag that still points at an erased person would check in
  -- "Verwijderd Cliënt" on the next scan. Retire it: the physical sticker is
  -- out there and must stop resolving to anybody.
  update public.nfc_tags
  set client_id = null, status = 'INACTIVE'
  where client_id = p_client_id
    and organization_id = p_organization_id;

  -- The links go first, so the orphan check below sees the new situation.
  delete from public.client_contacts where client_id = p_client_id;

  -- A contact who was only ever a contact for this client now has no purpose.
  -- Leaving them is the quiet way a "deleted" family stays in the database.
  with orphaned as (
    update public.contacts ct
    set first_name = 'Verwijderd',
        last_name = 'Contact',
        phone = null,
        email = null,
        user_id = null,
        anonymized_at = now()
    where ct.organization_id = p_organization_id
      and ct.anonymized_at is null
      and not exists (
        select 1 from public.client_contacts cc where cc.contact_id = ct.id
      )
    returning 1
  )
  select count(*) into v_contacts from orphaned;

  detached_user_id := v_user_id;
  contacts_anonymized := v_contacts;
  return next;
end;
$$;

revoke all on function public.anonymize_client(uuid, uuid) from public;
grant execute on function public.anonymize_client(uuid, uuid) to authenticated, service_role;

-- --- Export ---------------------------------------------------------------
--
-- Everything this system holds about one person, in one document (AVG art. 15
-- and 20). SECURITY INVOKER again: RLS decides what is in reach.
--
-- RLS ALONE IS NOT ENOUGH HERE, and the first version of this function proved
-- it. A driver can legitimately read the client of a ride they are assigned to
-- (decision D-11), so the `exists` guard below passed for them — and handed
-- back the complete dossier: every contact, every care organisation, every ride
-- ever, every change request. Being allowed to see who you are picking up is
-- not being allowed to download their file. Hence the explicit permission
-- check, which a driver does not hold.
create or replace function public.export_client_data(
  p_organization_id uuid,
  p_client_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'client', (
      select to_jsonb(c) - 'organization_id'
      from public.clients c
      where c.id = p_client_id and c.organization_id = p_organization_id
    ),
    'contacts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', ct.first_name || ' ' || ct.last_name,
        'email', ct.email,
        'phone', ct.phone,
        'relationship', cc.relationship,
        'can_view_rides', cc.can_view_rides,
        'can_report_absence', cc.can_report_absence,
        'can_request_changes', cc.can_request_changes
      ))
      from public.client_contacts cc
      join public.contacts ct on ct.id = cc.contact_id
      where cc.client_id = p_client_id
    ), '[]'::jsonb),
    'care_organizations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', co.name, 'valid_from', cco.valid_from, 'valid_to', cco.valid_to
      ))
      from public.client_care_organizations cco
      join public.care_organizations co on co.id = cco.care_organization_id
      where cco.client_id = p_client_id
    ), '[]'::jsonb),
    'rides', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', r.scheduled_date,
        'pickup_time', r.scheduled_pickup_time,
        'status', r.status,
        'absence_reason', r.absence_reason,
        'checked_in_at', r.checked_in_at,
        'completed_at', r.completed_at,
        'pickup', pl.name,
        'destination', dl.name
      ) order by r.scheduled_date desc)
      from public.rides r
      left join public.locations pl on pl.id = r.pickup_location_id
      left join public.locations dl on dl.id = r.destination_location_id
      where r.client_id = p_client_id and r.organization_id = p_organization_id
    ), '[]'::jsonb),
    'change_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', cr.kind,
        'status', cr.status,
        'payload', cr.payload,
        'review_note', cr.review_note,
        'created_at', cr.created_at
      ) order by cr.created_at desc)
      from public.change_requests cr
      where cr.client_id = p_client_id and cr.organization_id = p_organization_id
    ), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'public_code', t.public_code,
        'status', t.status,
        'activated_at', t.activated_at
      ))
      from public.nfc_tags t
      where t.client_id = p_client_id and t.organization_id = p_organization_id
    ), '[]'::jsonb)
  )
  where app.has_permission(p_organization_id, 'clients.view')
    and exists (
      select 1 from public.clients c
      where c.id = p_client_id and c.organization_id = p_organization_id
    );
$$;

revoke all on function public.export_client_data(uuid, uuid) from public;
grant execute on function public.export_client_data(uuid, uuid) to authenticated;

-- --- The retention sweep --------------------------------------------------
--
-- SECURITY DEFINER, because it runs from the nightly job where there is no
-- signed-in user at all. It is granted to the service role only, and it does
-- exactly what the organisation asked for in retention_policies — it takes no
-- instruction from a caller beyond which organisation to sweep.
create or replace function public.apply_retention(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy public.retention_policies%rowtype;
  v_client record;
  v_count integer := 0;
begin
  select * into v_policy
  from public.retention_policies
  where organization_id = p_organization_id;

  if not found or not v_policy.auto_anonymize_enabled then
    return 0;
  end if;

  for v_client in
    select c.id
    from public.clients c
    where c.organization_id = p_organization_id
      and c.anonymized_at is null
      and coalesce(
        (select max(r.scheduled_date) from public.rides r where r.client_id = c.id),
        c.created_at::date
      ) < (current_date - make_interval(months => v_policy.inactive_client_months))
  loop
    perform public.anonymize_client(p_organization_id, v_client.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.apply_retention(uuid) from public;
grant execute on function public.apply_retention(uuid) to service_role;
