-- ---------------------------------------------------------------------------
-- 0006 — Recurring templates, rides, and the append-only event log.
-- ---------------------------------------------------------------------------

create table ride_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  client_id uuid not null references clients (id) on delete restrict,
  name text,
  pickup_location_id uuid not null references locations (id) on delete restrict,
  destination_location_id uuid not null references locations (id) on delete restrict,
  -- Local wall-clock time, NOT an instant (decision D-07). "Every weekday at
  -- 08:00" must stay 08:00 across the DST change.
  departure_time time not null,
  -- ISO weekdays: 1 = Monday … 7 = Sunday.
  days_of_week smallint[] not null,
  starts_on date not null,
  ends_on date,
  default_driver_id uuid references drivers (id) on delete set null,
  default_vehicle_id uuid references vehicles (id) on delete set null,
  -- Decision D-03a: inherited by generated rides, overridable per ride.
  transport_requirements transport_requirement[] not null default '{}',
  status ride_template_status not null default 'ACTIVE',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ride_templates_days_not_empty check (array_length(days_of_week, 1) >= 1),
  constraint ride_templates_days_valid check (
    days_of_week <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  ),
  constraint ride_templates_end_after_start check (ends_on is null or ends_on >= starts_on),
  constraint ride_templates_distinct_locations
    check (pickup_location_id <> destination_location_id)
);
alter table ride_templates enable row level security;
create index ride_templates_org_idx on ride_templates (organization_id, status);
create index ride_templates_client_idx on ride_templates (client_id);

create table rides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  client_id uuid not null references clients (id) on delete restrict,
  -- set null, not cascade: deleting a template must not erase the rides it
  -- produced, which are the transport record.
  ride_template_id uuid references ride_templates (id) on delete set null,

  scheduled_date date not null,
  scheduled_pickup_time time not null,
  -- Derived from the two columns above plus the organisation's timezone. Kept
  -- for sorting and range queries; the local values remain authoritative.
  scheduled_pickup_at timestamptz not null,

  pickup_location_id uuid not null references locations (id) on delete restrict,
  destination_location_id uuid not null references locations (id) on delete restrict,
  driver_id uuid references drivers (id) on delete set null,
  vehicle_id uuid references vehicles (id) on delete set null,

  status ride_status not null default 'SCHEDULED',
  source ride_source not null default 'MANUAL',
  -- An exception: set when a planner edits a generated ride. Generation never
  -- touches a modified ride again (masterprompt §15, decision D-06).
  is_modified boolean not null default false,

  transport_requirements transport_requirement[] not null default '{}',
  absence_reason absence_reason,
  cancellation_reason text,
  notes text,

  -- Denormalised milestones for reporting. Always written in the same
  -- transaction as the corresponding ride_event.
  checked_in_at timestamptz,
  started_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,

  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rides_distinct_locations
    check (pickup_location_id <> destination_location_id),
  constraint rides_absence_reason_only_when_absent
    check (absence_reason is null or status = 'CLIENT_ABSENT')
);
alter table rides enable row level security;

-- Duplicate prevention at the database level (masterprompt §14). Application
-- logic is not enough: two concurrent generation jobs would otherwise both
-- succeed.
create unique index rides_template_date_unique
  on rides (ride_template_id, scheduled_date)
  where ride_template_id is not null;

create index rides_org_date_idx on rides (organization_id, scheduled_date);
create index rides_org_status_date_idx on rides (organization_id, status, scheduled_date);
create index rides_driver_date_idx on rides (driver_id, scheduled_date) where driver_id is not null;
create index rides_client_date_idx on rides (client_id, scheduled_date desc);
create index rides_vehicle_date_idx on rides (vehicle_id, scheduled_date) where vehicle_id is not null;

create table ride_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  ride_id uuid not null references rides (id) on delete cascade,
  event_type ride_event_type not null,
  -- occurred_at and recorded_at are separate because the driver PWA may be
  -- offline: the event happened at 08:27, the server heard about it at 08:41.
  -- Collapsing them would make the audit trail quietly wrong.
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  actor_user_id uuid references profiles (id) on delete set null,
  actor_kind actor_kind not null default 'SYSTEM',
  source event_source not null default 'MANUAL',
  nfc_tag_id uuid,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  accuracy_m numeric(8, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ride_events_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint ride_events_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint ride_events_coords_together check ((latitude is null) = (longitude is null))
);
alter table ride_events enable row level security;
create index ride_events_ride_idx on ride_events (ride_id, occurred_at);
create index ride_events_org_time_idx on ride_events (organization_id, occurred_at desc);

-- Idempotency for NFC/QR scanning (masterprompt §60). A driver taps the tag two
-- or three times because nothing visibly happened; the second insert must fail
-- rather than create a second check-in.
create unique index ride_events_once_per_ride
  on ride_events (ride_id, event_type)
  where event_type in (
    'CLIENT_CHECKED_IN', 'CLIENT_CHECKED_OUT',
    'TRIP_STARTED', 'ARRIVED', 'COMPLETED'
  );

-- --- Append-only enforcement, layer 3 of 3 --------------------------------
-- Layer 1 is the absence of update/delete policies, layer 2 is the revoked
-- privileges in the policies migration. This trigger is the backstop that
-- also catches a table owner or a future migration doing something careless.
create or replace function app.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only; % is not permitted', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

create trigger ride_events_append_only
  before update or delete on ride_events
  for each row execute function app.forbid_mutation();

create trigger ride_templates_touch before update on ride_templates
  for each row execute function app.touch_updated_at();
create trigger rides_touch before update on rides
  for each row execute function app.touch_updated_at();
