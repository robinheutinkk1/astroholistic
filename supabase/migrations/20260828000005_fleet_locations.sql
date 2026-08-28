-- ---------------------------------------------------------------------------
-- 0005 — Drivers, vehicles and locations.
-- ---------------------------------------------------------------------------

create table drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  -- Nullable: a driver can exist as a planning object before an account is
  -- invited, which is how most organisations actually onboard people.
  user_id uuid references profiles (id) on delete set null,
  employee_number text,
  first_name text not null,
  last_name text not null,
  phone text,
  email citext,
  status driver_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint drivers_first_name_not_blank check (length(btrim(first_name)) > 0),
  constraint drivers_last_name_not_blank check (length(btrim(last_name)) > 0)
);
alter table drivers enable row level security;
create index drivers_org_idx on drivers (organization_id, status) where deleted_at is null;
create index drivers_user_idx on drivers (user_id) where user_id is not null;
create unique index drivers_employee_number_unique
  on drivers (organization_id, employee_number)
  where employee_number is not null and deleted_at is null;
create unique index drivers_user_unique
  on drivers (organization_id, user_id)
  where user_id is not null and deleted_at is null;

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  license_plate text not null,
  make text,
  model text,
  vehicle_type text,
  seats integer not null default 0,
  wheelchair_positions integer not null default 0,
  is_wheelchair_accessible boolean not null default false,
  status vehicle_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vehicles_seats_non_negative check (seats >= 0),
  constraint vehicles_wheelchair_non_negative check (wheelchair_positions >= 0),
  -- Keeps the flag and the count from contradicting each other, which is what
  -- causes the wrong vehicle to be dispatched.
  constraint vehicles_wheelchair_consistent
    check (is_wheelchair_accessible = (wheelchair_positions > 0))
);
alter table vehicles enable row level security;
create index vehicles_org_idx on vehicles (organization_id, status) where deleted_at is null;
create unique index vehicles_plate_unique
  on vehicles (organization_id, upper(replace(license_plate, '-', '')))
  where deleted_at is null;

create table driver_vehicles (
  driver_id uuid not null references drivers (id) on delete cascade,
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (driver_id, vehicle_id)
);
alter table driver_vehicles enable row level security;
create index driver_vehicles_vehicle_idx on driver_vehicles (vehicle_id);
create unique index driver_vehicles_one_default
  on driver_vehicles (driver_id) where is_default;

create table locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  kind location_kind not null default 'OTHER',
  address_line1 text,
  postal_code text,
  city text,
  country text not null default 'NL',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  geocode_status geocode_status not null default 'PENDING',
  -- Provider details are data, not a hard dependency: the mapping provider sits
  -- behind an interface in the application (masterprompt §13).
  geocode_provider text,
  provider_place_ref text,
  access_notes text,
  status client_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint locations_name_not_blank check (length(btrim(name)) > 0),
  constraint locations_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint locations_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint locations_coords_together
    check ((latitude is null) = (longitude is null))
);
alter table locations enable row level security;
create index locations_org_idx on locations (organization_id, status) where deleted_at is null;
create index locations_org_kind_idx on locations (organization_id, kind) where deleted_at is null;

-- A client's home address as a reusable location. Added after `locations`
-- exists to avoid a circular dependency between the two tables.
alter table clients
  add column home_location_id uuid references locations (id) on delete set null;
create index clients_home_location_idx on clients (home_location_id);

create trigger drivers_touch before update on drivers
  for each row execute function app.touch_updated_at();
create trigger vehicles_touch before update on vehicles
  for each row execute function app.touch_updated_at();
create trigger locations_touch before update on locations
  for each row execute function app.touch_updated_at();
