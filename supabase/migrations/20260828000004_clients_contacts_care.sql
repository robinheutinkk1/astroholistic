-- ---------------------------------------------------------------------------
-- 0004 — Clients, their contacts, and the care organisations that fund them.
--
-- Note what `clients` does NOT contain (decision D-03): no transport
-- requirements, no free-text notes, no date of birth, no BSN. Transport needs
-- live on the ride. A free-text field on a person becomes a medical record,
-- which is explicitly not what this product is (masterprompt §8, §38).
-- ---------------------------------------------------------------------------

create table care_organizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  contact_email citext,
  phone text,
  address_line1 text,
  postal_code text,
  city text,
  country text not null default 'NL',
  external_reference text,
  status client_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint care_org_name_not_blank check (length(btrim(name)) > 0)
);
alter table care_organizations enable row level security;
create index care_organizations_org_idx on care_organizations (organization_id) where deleted_at is null;

create table clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  email citext,
  address_line1 text,
  postal_code text,
  city text,
  country text not null default 'NL',
  external_reference text,
  status client_status not null default 'ACTIVE',
  -- Optional client-portal account.
  user_id uuid references profiles (id) on delete set null,
  -- GDPR erasure anonymises rather than deletes, so ride history and the audit
  -- trail survive while the person no longer does (docs/DATABASE.md §10).
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint clients_first_name_not_blank check (length(btrim(first_name)) > 0),
  constraint clients_last_name_not_blank check (length(btrim(last_name)) > 0)
);
alter table clients enable row level security;
create index clients_org_idx on clients (organization_id, status) where deleted_at is null;
create index clients_org_name_idx on clients (organization_id, last_name, first_name);
create unique index clients_external_ref_unique
  on clients (organization_id, external_reference)
  where external_reference is not null and deleted_at is null;
create unique index clients_user_unique on clients (user_id) where user_id is not null;

create table contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  email citext,
  user_id uuid references profiles (id) on delete set null,
  status client_status not null default 'ACTIVE',
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table contacts enable row level security;
create index contacts_org_idx on contacts (organization_id) where deleted_at is null;
create index contacts_user_idx on contacts (user_id) where user_id is not null;

-- Permissions live on the LINK, not on the contact. A parent may report an
-- absence for one child but not another; putting the flags here makes that
-- expressible without exceptions in the policy (docs/DATABASE.md §5).
create table client_contacts (
  client_id uuid not null references clients (id) on delete cascade,
  contact_id uuid not null references contacts (id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  can_view_rides boolean not null default true,
  can_report_absence boolean not null default false,
  can_request_changes boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (client_id, contact_id)
);
alter table client_contacts enable row level security;
create index client_contacts_contact_idx on client_contacts (contact_id);

create table care_organization_users (
  id uuid primary key default gen_random_uuid(),
  care_organization_id uuid not null references care_organizations (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status membership_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (care_organization_id, user_id)
);
alter table care_organization_users enable row level security;
create index care_organization_users_user_idx on care_organization_users (user_id, status);

-- Validity window so a funder that stops paying loses access to new rides
-- without the historical record disappearing.
create table client_care_organizations (
  client_id uuid not null references clients (id) on delete cascade,
  care_organization_id uuid not null references care_organizations (id) on delete cascade,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  primary key (client_id, care_organization_id, valid_from),
  constraint client_care_valid_range check (valid_to is null or valid_to >= valid_from)
);
alter table client_care_organizations enable row level security;
create index client_care_org_idx on client_care_organizations (care_organization_id);

create trigger care_organizations_touch before update on care_organizations
  for each row execute function app.touch_updated_at();
create trigger clients_touch before update on clients
  for each row execute function app.touch_updated_at();
create trigger contacts_touch before update on contacts
  for each row execute function app.touch_updated_at();
create trigger care_organization_users_touch before update on care_organization_users
  for each row execute function app.touch_updated_at();
