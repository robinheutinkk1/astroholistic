-- ---------------------------------------------------------------------------
-- 0014 — Group transport: trips, stops and capacity.
--
-- WHY THIS EXISTS
-- ---------------
-- The primary use case is group transport: one bus collects several clients at
-- one location — a day care centre, a school — and the driver checks them in
-- there. Until now a journey with five passengers was five unrelated `rides`
-- rows, which meant:
--
--   * no capacity check (five clients fitted in a six-seat bus, but so did ten)
--   * a driver could be booked in two places at once
--   * the driver's screen would show five separate rides instead of one stop
--     with five people, requiring five taps of "I have arrived" before scanning
--   * five clients going to the same day care daily needed five separate
--     recurring templates
--
-- The per-passenger `rides` row stays exactly as it was — that is the right
-- grain for check-in, absence and reporting. What is added is the layer above
-- it: the journey the vehicle actually makes.
-- ---------------------------------------------------------------------------

create extension if not exists btree_gist;

create type trip_status as enum (
  'PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
);

-- Whether passengers board, alight, or both at a stop.
create type stop_kind as enum ('PICKUP', 'DROPOFF', 'BOTH');

create table trips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text,
  scheduled_date date not null,
  driver_id uuid references drivers (id) on delete set null,
  vehicle_id uuid references vehicles (id) on delete set null,
  status trip_status not null default 'PLANNED',
  -- Local wall-clock, consistent with rides (decision D-07).
  planned_start_time time not null,
  planned_start_at timestamptz not null,
  planned_end_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_end_after_start check (planned_end_at > planned_start_at)
);
alter table trips enable row level security;
create index trips_org_date_idx on trips (organization_id, scheduled_date);
create index trips_driver_date_idx on trips (driver_id, scheduled_date) where driver_id is not null;
create index trips_vehicle_date_idx on trips (vehicle_id, scheduled_date) where vehicle_id is not null;

-- A driver cannot be on two overlapping trips, and neither can a vehicle.
-- Expressed as exclusion constraints rather than triggers because they are
-- race-safe: two planners saving at the same moment cannot both win.
alter table trips add constraint trips_driver_no_overlap
  exclude using gist (
    driver_id with =,
    tstzrange(planned_start_at, planned_end_at) with &&
  ) where (driver_id is not null and status <> 'CANCELLED');

alter table trips add constraint trips_vehicle_no_overlap
  exclude using gist (
    vehicle_id with =,
    tstzrange(planned_start_at, planned_end_at) with &&
  ) where (vehicle_id is not null and status <> 'CANCELLED');

create table trip_stops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  trip_id uuid not null references trips (id) on delete cascade,
  location_id uuid not null references locations (id) on delete restrict,
  sequence smallint not null,
  kind stop_kind not null default 'BOTH',
  planned_arrival_time time,
  planned_arrival_at timestamptz,
  -- Set once, for the whole stop: this is the "I have arrived" the driver
  -- presses a single time, rather than once per passenger.
  arrived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_stops_sequence_positive check (sequence >= 1),
  unique (trip_id, sequence)
);
alter table trip_stops enable row level security;
create index trip_stops_trip_idx on trip_stops (trip_id, sequence);

-- Link the passenger legs to the journey.
alter table rides
  add column trip_id uuid references trips (id) on delete set null,
  add column pickup_stop_id uuid references trip_stops (id) on delete set null,
  add column dropoff_stop_id uuid references trip_stops (id) on delete set null,
  -- Decision from 2026-08-28: a driver may check a passenger off by hand when
  -- the tag is forgotten or the client is already aboard. Both routes record
  -- the same fact; `ride_events.source` keeps them distinguishable in reports.
  add column checked_in_method event_source;

create index rides_trip_idx on rides (trip_id) where trip_id is not null;

-- Recurring group transport: one template for the whole bus run, with a
-- ride_template per passenger hanging off it. Without this, a group of five
-- would still be five templates a planner has to keep in sync by hand.
create table trip_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  departure_time time not null,
  days_of_week smallint[] not null,
  starts_on date not null,
  ends_on date,
  default_driver_id uuid references drivers (id) on delete set null,
  default_vehicle_id uuid references vehicles (id) on delete set null,
  status ride_template_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_templates_days_not_empty check (array_length(days_of_week, 1) >= 1),
  constraint trip_templates_days_valid check (
    days_of_week <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  ),
  constraint trip_templates_end_after_start check (ends_on is null or ends_on >= starts_on)
);
alter table trip_templates enable row level security;
create index trip_templates_org_idx on trip_templates (organization_id, status);

alter table ride_templates
  add column trip_template_id uuid references trip_templates (id) on delete set null;
create index ride_templates_trip_template_idx
  on ride_templates (trip_template_id) where trip_template_id is not null;

create trigger trips_touch before update on trips
  for each row execute function app.touch_updated_at();
create trigger trip_stops_touch before update on trip_stops
  for each row execute function app.touch_updated_at();
create trigger trip_templates_touch before update on trip_templates
  for each row execute function app.touch_updated_at();


-- ---------------------------------------------------------------------------
-- Integrity: a ride's stops must belong to the ride's own trip, and a passenger
-- must board before they alight.
-- ---------------------------------------------------------------------------
create or replace function app.enforce_ride_trip_consistency()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_pickup_trip uuid;
  v_dropoff_trip uuid;
  v_pickup_seq smallint;
  v_dropoff_seq smallint;
  v_trip_org uuid;
begin
  if new.trip_id is null then
    if new.pickup_stop_id is not null or new.dropoff_stop_id is not null then
      raise exception 'A ride cannot reference trip stops without a trip'
        using errcode = '23514';
    end if;
    return new;
  end if;

  select organization_id into v_trip_org from public.trips where id = new.trip_id;
  if v_trip_org is distinct from new.organization_id then
    raise exception 'Ride and trip belong to different organisations'
      using errcode = '42501';
  end if;

  if new.pickup_stop_id is not null then
    select trip_id, sequence into v_pickup_trip, v_pickup_seq
    from public.trip_stops where id = new.pickup_stop_id;
    if v_pickup_trip is distinct from new.trip_id then
      raise exception 'Pickup stop does not belong to this trip' using errcode = '23514';
    end if;
  end if;

  if new.dropoff_stop_id is not null then
    select trip_id, sequence into v_dropoff_trip, v_dropoff_seq
    from public.trip_stops where id = new.dropoff_stop_id;
    if v_dropoff_trip is distinct from new.trip_id then
      raise exception 'Dropoff stop does not belong to this trip' using errcode = '23514';
    end if;
  end if;

  if v_pickup_seq is not null and v_dropoff_seq is not null
     and v_pickup_seq >= v_dropoff_seq then
    raise exception 'A passenger must board before alighting (stop % is not before %)',
      v_pickup_seq, v_dropoff_seq using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger rides_trip_consistency
  before insert or update of trip_id, pickup_stop_id, dropoff_stop_id on rides
  for each row execute function app.enforce_ride_trip_consistency();


-- ---------------------------------------------------------------------------
-- Capacity.
--
-- Occupancy is NOT simply "how many passengers are on this trip": people alight
-- along the route, so a six-seat bus can legitimately carry ten passengers over
-- a morning. What matters is the largest number aboard at any single moment.
--
-- Occupancy after stop k = passengers whose pickup sequence <= k and whose
-- dropoff sequence > k. The maximum of that over all stops is the real load.
-- ---------------------------------------------------------------------------
create or replace function app.trip_peak_occupancy(p_trip_id uuid)
returns table (passengers integer, wheelchairs integer)
language sql
stable
set search_path = ''
as $$
  with legs as (
    select
      ps.sequence as from_seq,
      ds.sequence as to_seq,
      ('WHEELCHAIR' = any (r.transport_requirements)) as needs_wheelchair
    from public.rides r
    join public.trip_stops ps on ps.id = r.pickup_stop_id
    join public.trip_stops ds on ds.id = r.dropoff_stop_id
    where r.trip_id = p_trip_id
      and r.status not in ('CANCELLED', 'CLIENT_ABSENT')
  ),
  points as (
    select distinct sequence from public.trip_stops where trip_id = p_trip_id
  )
  select
    coalesce(max(occupancy), 0)::integer,
    coalesce(max(wheelchair_occupancy), 0)::integer
  from (
    select
      count(*) filter (where true) as occupancy,
      count(*) filter (where legs.needs_wheelchair) as wheelchair_occupancy
    from points
    join legs on legs.from_seq <= points.sequence and legs.to_seq > points.sequence
    group by points.sequence
  ) per_stop;
$$;

create or replace function app.enforce_trip_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_trip_id uuid;
  v_seats integer;
  v_wheelchair_positions integer;
  v_peak record;
begin
  v_trip_id := coalesce(new.trip_id, old.trip_id);
  if v_trip_id is null then
    return coalesce(new, old);
  end if;

  select v.seats, v.wheelchair_positions
  into v_seats, v_wheelchair_positions
  from public.trips t
  join public.vehicles v on v.id = t.vehicle_id
  where t.id = v_trip_id;

  -- No vehicle assigned yet is a normal planning state, not an error.
  if v_seats is null then
    return coalesce(new, old);
  end if;

  select * into v_peak from app.trip_peak_occupancy(v_trip_id);

  if v_peak.passengers > v_seats then
    raise exception
      'Trip exceeds vehicle capacity: % passengers aboard at once, % seats available',
      v_peak.passengers, v_seats using errcode = '23514';
  end if;

  if v_peak.wheelchairs > v_wheelchair_positions then
    raise exception
      'Trip exceeds wheelchair capacity: % wheelchair passengers, % positions available',
      v_peak.wheelchairs, v_wheelchair_positions using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

-- Deferred so a planner can build a whole trip inside one transaction and be
-- checked at commit, rather than being blocked halfway through.
create constraint trigger rides_trip_capacity
  after insert or update on rides
  deferrable initially deferred
  for each row execute function app.enforce_trip_capacity();
