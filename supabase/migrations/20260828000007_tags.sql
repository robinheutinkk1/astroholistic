-- ---------------------------------------------------------------------------
-- 0007 — TagPoint NFC/QR tags.
--
-- One tag, one token, one status model. QR is a rendering of the same URL, not
-- a second system, so there is no qr_codes table (decision D-05). Two tables
-- would allow "revoked as NFC, still valid as QR".
-- ---------------------------------------------------------------------------

create table nfc_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  -- Human-facing code for labels, inventory and support. NOT in the URL: a
  -- readable code is enumerable (docs/NFC.md §2).
  public_code citext not null,
  -- SHA-256 of the 128-bit URL token plus a server-side pepper. The token
  -- itself is never stored, so a database dump yields no working tag URLs.
  token_hash bytea not null unique,
  client_id uuid references clients (id) on delete set null,
  status tag_status not null default 'UNASSIGNED',
  label text,
  replaced_by_tag_id uuid references nfc_tags (id) on delete set null,
  activated_at timestamptz,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nfc_tags_token_hash_length check (octet_length(token_hash) = 32),
  -- An ACTIVE tag must point at someone; an UNASSIGNED one must not.
  constraint nfc_tags_active_has_client
    check ((status = 'ACTIVE') <= (client_id is not null)),
  constraint nfc_tags_unassigned_has_no_client
    check ((status = 'UNASSIGNED') <= (client_id is null))
);
alter table nfc_tags enable row level security;
create unique index nfc_tags_public_code_unique on nfc_tags (organization_id, public_code);
create index nfc_tags_org_status_idx on nfc_tags (organization_id, status);
-- At most one active tag per client, so a scan is never ambiguous.
create unique index nfc_tags_one_active_per_client
  on nfc_tags (client_id) where status = 'ACTIVE' and client_id is not null;

alter table ride_events
  add constraint ride_events_nfc_tag_fk
  foreign key (nfc_tag_id) references nfc_tags (id) on delete set null;

-- Full assignment history, so "who attached which tag to whom, and when" is
-- answerable years later.
create table tag_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  nfc_tag_id uuid not null references nfc_tags (id) on delete cascade,
  client_id uuid not null references clients (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references profiles (id) on delete set null,
  unassigned_at timestamptz,
  unassigned_by uuid references profiles (id) on delete set null,
  reason text,
  constraint tag_assignments_unassign_after_assign
    check (unassigned_at is null or unassigned_at >= assigned_at)
);
alter table tag_assignments enable row level security;
create index tag_assignments_tag_idx on tag_assignments (nfc_tag_id, assigned_at desc);
create index tag_assignments_client_idx on tag_assignments (client_id, assigned_at desc);

create trigger nfc_tags_touch before update on nfc_tags
  for each row execute function app.touch_updated_at();
