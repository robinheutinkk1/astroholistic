-- ---------------------------------------------------------------------------
-- 0001 — Extensions, the private `app` schema, and every enum type.
--
-- Enums live in one migration so the vocabulary of the domain is readable in a
-- single place. Adding a value later is `alter type ... add value`, which is a
-- forward-only change and therefore fine.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Helper functions live outside `public` so they are never exposed through
-- PostgREST as callable RPCs.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, anon, service_role;

-- --- Tenancy ---------------------------------------------------------------
create type org_status as enum ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');
create type domain_verification_status as enum ('PENDING', 'VERIFIED', 'FAILED');
create type checkout_mode as enum ('DISABLED', 'OPTIONAL', 'REQUIRED');
create type subscription_status as enum ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- --- Identity --------------------------------------------------------------
create type membership_status as enum ('INVITED', 'ACTIVE', 'SUSPENDED');
create type account_status as enum ('ACTIVE', 'SUSPENDED');

-- --- People and organisations ----------------------------------------------
create type client_status as enum ('ACTIVE', 'INACTIVE');
create type driver_status as enum ('ACTIVE', 'INACTIVE', 'ON_LEAVE');
create type vehicle_status as enum ('ACTIVE', 'INACTIVE', 'MAINTENANCE');
create type location_kind as enum (
  'HOME', 'SCHOOL', 'DAY_CARE', 'CARE_FACILITY',
  'WORK', 'STATION', 'HOSPITAL', 'OTHER'
);
create type geocode_status as enum ('PENDING', 'RESOLVED', 'FAILED', 'MANUAL');

-- --- Rides -----------------------------------------------------------------
create type ride_status as enum (
  'SCHEDULED',
  'DRIVER_ASSIGNED',
  'DRIVER_EN_ROUTE',
  'DRIVER_ARRIVED',
  'CLIENT_CHECKED_IN',
  'TRIP_STARTED',
  'ARRIVED',
  'COMPLETED',
  'CLIENT_ABSENT',
  'CANCELLED',
  'PROBLEM'
);
create type ride_source as enum ('TEMPLATE', 'MANUAL');
create type ride_template_status as enum ('ACTIVE', 'PAUSED', 'ARCHIVED');
create type absence_reason as enum (
  'NOT_HOME', 'CANCELLED_BY_CLIENT', 'ILL', 'NO_ACCESS', 'OTHER'
);

-- Ride events are append-only; this list is the audit vocabulary.
create type ride_event_type as enum (
  'CREATED',
  'DRIVER_ASSIGNED',
  'DRIVER_UNASSIGNED',
  'VEHICLE_ASSIGNED',
  'DRIVER_EN_ROUTE',
  'DRIVER_ARRIVED',
  'CLIENT_CHECKED_IN',
  'CLIENT_CHECKED_OUT',
  'TRIP_STARTED',
  'ARRIVED',
  'COMPLETED',
  'CLIENT_ABSENT',
  'CANCELLED',
  'PROBLEM_REPORTED',
  'NOTE_ADDED',
  'RESCHEDULED'
);
create type event_source as enum ('NFC', 'QR', 'MANUAL', 'SYSTEM');
create type actor_kind as enum ('DRIVER', 'PLANNER', 'SYSTEM', 'PORTAL', 'PLATFORM');

-- Decision D-03: transport requirements live on the ride, never on the client.
-- Closed enum only — there is deliberately no free-text field, because a free
-- field becomes a medical record (docs/RISKS_AND_DECISIONS.md D-03).
create type transport_requirement as enum (
  'WHEELCHAIR',
  'WALKER',
  'ASSISTANCE_TO_DOOR',
  'SEATBELT_SUPPORT',
  'COMPANION_SEAT'
);

-- --- Tags ------------------------------------------------------------------
create type tag_status as enum ('UNASSIGNED', 'ACTIVE', 'INACTIVE', 'LOST', 'REPLACED');

-- --- Portals and cross-cutting ---------------------------------------------
create type requester_kind as enum ('CLIENT', 'CONTACT', 'CARE_ORG');
create type change_request_kind as enum (
  'ABSENCE', 'TIME_CHANGE', 'DESTINATION_CHANGE', 'CANCEL', 'OTHER'
);
create type change_request_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');
create type notification_channel as enum ('IN_APP', 'EMAIL', 'PUSH');


-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest.
-- ---------------------------------------------------------------------------
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- Timezone validation, used by a check constraint on organization_settings.
-- Catching a typo'd IANA name at write time is far cheaper than discovering it
-- when ride generation runs at 03:00.
-- ---------------------------------------------------------------------------
create or replace function app.is_valid_timezone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if tz is null then
    return false;
  end if;
  perform now() at time zone tz;
  return true;
exception
  when others then
    return false;
end;
$$;
