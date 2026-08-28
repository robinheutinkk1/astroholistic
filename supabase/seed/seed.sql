-- ---------------------------------------------------------------------------
-- Development seed data (masterprompt §55).
--
-- Entirely fictional people. No real personal data, ever — not even "borrowed"
-- from a customer's spreadsheet for convenience.
--
-- TWO organisations on purpose. A single-tenant seed cannot demonstrate the one
-- property that matters most here: that organisation A cannot see organisation
-- B. Every fixture below has a counterpart in the other tenant.
--
-- UUIDs are fixed so the security suite can address rows by name.
-- ---------------------------------------------------------------------------

begin;

-- --- Accounts --------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'admin@ontzorgd.test'),
  ('a0000000-0000-4000-8000-000000000002', 'planner@ontzorgd.test'),
  ('a0000000-0000-4000-8000-000000000003', 'dispatcher@ontzorgd.test'),
  ('a0000000-0000-4000-8000-000000000004', 'chauffeur1@ontzorgd.test'),
  ('a0000000-0000-4000-8000-000000000005', 'chauffeur2@ontzorgd.test'),
  ('a0000000-0000-4000-8000-000000000006', 'ouder@ontzorgd.test'),
  ('a0000000-0000-4000-8000-000000000007', 'zorginstelling@ontzorgd.test'),
  ('a0000000-0000-4000-8000-000000000008', 'client@ontzorgd.test'),
  ('b0000000-0000-4000-8000-000000000001', 'admin@voorbeeldtaxi.test'),
  ('b0000000-0000-4000-8000-000000000004', 'chauffeur@voorbeeldtaxi.test'),
  ('c0000000-0000-4000-8000-000000000001', 'platform@tagpoint.test'),
  ('d0000000-0000-4000-8000-000000000001', 'buitenstaander@example.test')
on conflict do nothing;

insert into profiles (id, email, full_name) values
  ('a0000000-0000-4000-8000-000000000001', 'admin@ontzorgd.test',        'Anna Admin'),
  ('a0000000-0000-4000-8000-000000000002', 'planner@ontzorgd.test',      'Peter Planner'),
  ('a0000000-0000-4000-8000-000000000003', 'dispatcher@ontzorgd.test',   'Dana Dispatch'),
  ('a0000000-0000-4000-8000-000000000004', 'chauffeur1@ontzorgd.test',   'Kees Chauffeur'),
  ('a0000000-0000-4000-8000-000000000005', 'chauffeur2@ontzorgd.test',   'Sanne Chauffeur'),
  ('a0000000-0000-4000-8000-000000000006', 'ouder@ontzorgd.test',        'Olga Ouder'),
  ('a0000000-0000-4000-8000-000000000007', 'zorginstelling@ontzorgd.test','Zoë Zorg'),
  ('a0000000-0000-4000-8000-000000000008', 'client@ontzorgd.test',       'Jan Jansen'),
  ('b0000000-0000-4000-8000-000000000001', 'admin@voorbeeldtaxi.test',   'Bram Beheer'),
  ('b0000000-0000-4000-8000-000000000004', 'chauffeur@voorbeeldtaxi.test','Bas Bestuurder'),
  ('c0000000-0000-4000-8000-000000000001', 'platform@tagpoint.test',     'Pia Platform'),
  ('d0000000-0000-4000-8000-000000000001', 'buitenstaander@example.test','Otto Outsider')
on conflict do nothing;

insert into platform_admins (user_id, note)
values ('c0000000-0000-4000-8000-000000000001', 'Seed platform administrator');

-- --- Organisations ---------------------------------------------------------
insert into organizations (id, slug, name, status, is_demo) values
  ('0a000000-0000-4000-8000-000000000000', 'taxi-ontzorgd-demo', 'Taxi Ontzorgd Demo', 'ACTIVE', true),
  ('0b000000-0000-4000-8000-000000000000', 'voorbeeldtaxi-demo', 'Voorbeeld Taxi BV',  'ACTIVE', true);

insert into organization_settings (organization_id, checkout_mode) values
  ('0a000000-0000-4000-8000-000000000000', 'OPTIONAL'),
  ('0b000000-0000-4000-8000-000000000000', 'REQUIRED');

insert into organization_branding (organization_id, display_name, primary_color) values
  ('0a000000-0000-4000-8000-000000000000', 'Taxi Ontzorgd', '#1f47d6'),
  ('0b000000-0000-4000-8000-000000000000', 'Voorbeeld Taxi', '#0d9488');

insert into organization_domains (organization_id, hostname, is_primary, verification_status) values
  ('0a000000-0000-4000-8000-000000000000', 'dispatch.taxi-ontzorgd.test', true, 'VERIFIED'),
  ('0b000000-0000-4000-8000-000000000000', 'planning.voorbeeldtaxi.test', true, 'VERIFIED');

-- --- Memberships and roles -------------------------------------------------
insert into organization_users (id, organization_id, user_id, status) values
  ('1a000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'ACTIVE'),
  ('1a000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'ACTIVE'),
  ('1a000000-0000-4000-8000-000000000003', '0a000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000003', 'ACTIVE'),
  ('1a000000-0000-4000-8000-000000000004', '0a000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000004', 'ACTIVE'),
  ('1a000000-0000-4000-8000-000000000005', '0a000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000005', 'ACTIVE'),
  ('1b000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000000', 'b0000000-0000-4000-8000-000000000001', 'ACTIVE'),
  ('1b000000-0000-4000-8000-000000000004', '0b000000-0000-4000-8000-000000000000', 'b0000000-0000-4000-8000-000000000004', 'ACTIVE');

insert into organization_user_roles (organization_user_id, role_id)
select ou.id, r.id
from (values
  ('1a000000-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('1a000000-0000-4000-8000-000000000002'::uuid, 'planner'),
  ('1a000000-0000-4000-8000-000000000003'::uuid, 'dispatcher'),
  ('1a000000-0000-4000-8000-000000000004'::uuid, 'driver'),
  ('1a000000-0000-4000-8000-000000000005'::uuid, 'driver'),
  ('1b000000-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('1b000000-0000-4000-8000-000000000004'::uuid, 'driver')
) as m (ou_id, role_key)
join organization_users ou on ou.id = m.ou_id
join roles r on r.key = m.role_key and r.is_system;

-- --- Locations -------------------------------------------------------------
insert into locations (id, organization_id, name, kind, address_line1, postal_code, city) values
  ('10000000-0000-4000-8000-00000000000a', '0a000000-0000-4000-8000-000000000000', 'Woning Jansen',       'HOME',        'Beukstraat 12',   '7551AA', 'Hengelo'),
  ('10000000-0000-4000-8000-00000000000b', '0a000000-0000-4000-8000-000000000000', 'Dagbesteding De Es',  'DAY_CARE',    'Esweg 3',         '7552BB', 'Hengelo'),
  ('10000000-0000-4000-8000-00000000000c', '0a000000-0000-4000-8000-000000000000', 'Woning De Vries',     'HOME',        'Lindelaan 8',     '7511CC', 'Enschede'),
  ('10000000-0000-4000-8000-00000000000d', '0a000000-0000-4000-8000-000000000000', 'Werkplaats Noord',    'WORK',        'Industrieweg 44', '7512DD', 'Enschede'),
  ('10000000-0000-4000-8000-00000000000e', '0a000000-0000-4000-8000-000000000000', 'Station Hengelo',     'STATION',     'Stationsplein 1', '7551EE', 'Hengelo'),
  ('10000000-0000-4000-8000-00000000001a', '0b000000-0000-4000-8000-000000000000', 'Woning Bakker',       'HOME',        'Kerkstraat 5',    '1011AA', 'Amsterdam'),
  ('10000000-0000-4000-8000-00000000001b', '0b000000-0000-4000-8000-000000000000', 'Zorgcentrum Zuid',    'CARE_FACILITY','Zuidas 100',     '1012BB', 'Amsterdam');

-- --- Care organisations ----------------------------------------------------
insert into care_organizations (id, organization_id, name, contact_email) values
  ('20000000-0000-4000-8000-00000000000a', '0a000000-0000-4000-8000-000000000000', 'Zorginstelling De Brug', 'contact@debrug.test'),
  ('20000000-0000-4000-8000-00000000001a', '0b000000-0000-4000-8000-000000000000', 'Gemeente Voorbeeld',     'wmo@voorbeeld.test');

insert into care_organization_users (care_organization_id, user_id, status) values
  ('20000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000007', 'ACTIVE');

-- --- Clients ---------------------------------------------------------------
insert into clients (id, organization_id, first_name, last_name, city, home_location_id, user_id, external_reference) values
  ('30000000-0000-4000-8000-00000000000a', '0a000000-0000-4000-8000-000000000000', 'Jan',    'Jansen',   'Hengelo',  '10000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000008', 'TO-001'),
  ('30000000-0000-4000-8000-00000000000b', '0a000000-0000-4000-8000-000000000000', 'Piet',   'de Vries', 'Enschede', '10000000-0000-4000-8000-00000000000c', null, 'TO-002'),
  ('30000000-0000-4000-8000-00000000000c', '0a000000-0000-4000-8000-000000000000', 'Fatima', 'El Amrani','Hengelo',  null, null, 'TO-003'),
  ('30000000-0000-4000-8000-00000000000d', '0a000000-0000-4000-8000-000000000000', 'Sofie',  'Bakker',   'Enschede', null, null, 'TO-004'),
  ('30000000-0000-4000-8000-00000000000e', '0a000000-0000-4000-8000-000000000000', 'Ahmed',  'Yilmaz',   'Hengelo',  null, null, 'TO-005'),
  ('30000000-0000-4000-8000-00000000001a', '0b000000-0000-4000-8000-000000000000', 'Klaas',  'Bakker',   'Amsterdam','10000000-0000-4000-8000-00000000001a', null, 'VB-001'),
  ('30000000-0000-4000-8000-00000000001b', '0b000000-0000-4000-8000-000000000000', 'Marie',  'Visser',   'Amsterdam', null, null, 'VB-002');

-- Client 1 is funded by De Brug; client 2 deliberately is not, so the care
-- portal's scoping can be tested rather than assumed.
insert into client_care_organizations (client_id, care_organization_id, valid_from) values
  ('30000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', current_date - 30);

-- --- Contacts --------------------------------------------------------------
insert into contacts (id, organization_id, first_name, last_name, user_id) values
  ('40000000-0000-4000-8000-00000000000a', '0a000000-0000-4000-8000-000000000000', 'Olga', 'Ouder', 'a0000000-0000-4000-8000-000000000006');

-- Olga is linked to Jan only. Piet is another client in the SAME organisation,
-- which is exactly the case that must stay invisible to her.
insert into client_contacts (client_id, contact_id, relationship, is_primary, can_view_rides, can_report_absence) values
  ('30000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-00000000000a', 'moeder', true, true, true);

-- --- Fleet -----------------------------------------------------------------
insert into drivers (id, organization_id, user_id, employee_number, first_name, last_name) values
  ('50000000-0000-4000-8000-00000000000a', '0a000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000004', 'TO-D01', 'Kees',  'Chauffeur'),
  ('50000000-0000-4000-8000-00000000000b', '0a000000-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000005', 'TO-D02', 'Sanne', 'Chauffeur'),
  ('50000000-0000-4000-8000-00000000000c', '0a000000-0000-4000-8000-000000000000', null,                                    'TO-D03', 'Ruud',  'Reserve'),
  ('50000000-0000-4000-8000-00000000001a', '0b000000-0000-4000-8000-000000000000', 'b0000000-0000-4000-8000-000000000004', 'VB-D01', 'Bas',   'Bestuurder');

insert into vehicles (id, organization_id, license_plate, make, model, seats, wheelchair_positions, is_wheelchair_accessible) values
  ('60000000-0000-4000-8000-00000000000a', '0a000000-0000-4000-8000-000000000000', '12-ABC-3', 'Mercedes', 'Sprinter', 8, 2, true),
  ('60000000-0000-4000-8000-00000000000b', '0a000000-0000-4000-8000-000000000000', '45-DEF-6', 'Ford',     'Tourneo',  6, 0, false),
  ('60000000-0000-4000-8000-00000000001a', '0b000000-0000-4000-8000-000000000000', '78-GHI-9', 'Opel',     'Vivaro',   7, 0, false);

insert into driver_vehicles (driver_id, vehicle_id, is_default) values
  ('50000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-00000000000a', true),
  ('50000000-0000-4000-8000-00000000000b', '60000000-0000-4000-8000-00000000000b', true);

-- --- Recurring templates ---------------------------------------------------
insert into ride_templates (id, organization_id, client_id, name, pickup_location_id, destination_location_id,
                            departure_time, days_of_week, starts_on, default_driver_id, default_vehicle_id,
                            transport_requirements)
values
  ('70000000-0000-4000-8000-00000000000a', '0a000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-00000000000a',
   'Heenrit dagbesteding', '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000b',
   '08:00', array[1,2,3,4,5]::smallint[], current_date - 60,
   '50000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-00000000000a',
   array['WHEELCHAIR']::transport_requirement[]),
  ('70000000-0000-4000-8000-00000000000b', '0a000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-00000000000a',
   'Terugrit dagbesteding', '10000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000a',
   '16:00', array[1,2,3,4,5]::smallint[], current_date - 60,
   '50000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-00000000000a',
   array['WHEELCHAIR']::transport_requirement[]);

-- --- Rides -----------------------------------------------------------------
-- Kees (driver A1) drives Jan. Sanne (driver A2) drives Piet. That split is
-- what makes "a driver must not see a colleague's ride" testable.
insert into rides (id, organization_id, client_id, ride_template_id, scheduled_date, scheduled_pickup_time,
                   scheduled_pickup_at, pickup_location_id, destination_location_id, driver_id, vehicle_id,
                   status, source, transport_requirements)
values
  ('80000000-0000-4000-8000-00000000000a', '0a000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-00000000000a',
   '70000000-0000-4000-8000-00000000000a', current_date, '08:00',
   (current_date + time '08:00') at time zone 'Europe/Amsterdam',
   '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000b',
   '50000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-00000000000a',
   'DRIVER_ASSIGNED', 'TEMPLATE', array['WHEELCHAIR']::transport_requirement[]),

  ('80000000-0000-4000-8000-00000000000b', '0a000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-00000000000b',
   null, current_date, '09:00',
   (current_date + time '09:00') at time zone 'Europe/Amsterdam',
   '10000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-00000000000d',
   '50000000-0000-4000-8000-00000000000b', '60000000-0000-4000-8000-00000000000b',
   'SCHEDULED', 'MANUAL', '{}'),

  ('80000000-0000-4000-8000-00000000000c', '0a000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-00000000000c',
   null, current_date, '10:00',
   (current_date + time '10:00') at time zone 'Europe/Amsterdam',
   '10000000-0000-4000-8000-00000000000e', '10000000-0000-4000-8000-00000000000d',
   null, null, 'SCHEDULED', 'MANUAL', '{}'),

  ('80000000-0000-4000-8000-00000000001a', '0b000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-00000000001a',
   null, current_date, '08:30',
   (current_date + time '08:30') at time zone 'Europe/Amsterdam',
   '10000000-0000-4000-8000-00000000001a', '10000000-0000-4000-8000-00000000001b',
   '50000000-0000-4000-8000-00000000001a', '60000000-0000-4000-8000-00000000001a',
   'DRIVER_ASSIGNED', 'MANUAL', '{}');

insert into ride_events (organization_id, ride_id, event_type, actor_kind, source) values
  ('0a000000-0000-4000-8000-000000000000', '80000000-0000-4000-8000-00000000000a', 'CREATED', 'SYSTEM', 'SYSTEM'),
  ('0a000000-0000-4000-8000-000000000000', '80000000-0000-4000-8000-00000000000a', 'DRIVER_ASSIGNED', 'PLANNER', 'MANUAL');

-- --- Tags ------------------------------------------------------------------
-- token_hash is a placeholder digest; real tokens are generated server-side and
-- shown once (docs/NFC.md §10).
insert into nfc_tags (id, organization_id, public_code, token_hash, client_id, status, activated_at) values
  ('90000000-0000-4000-8000-00000000000a', '0a000000-0000-4000-8000-000000000000', 'TP-TAXI-8F3A21',
   digest('seed-token-a', 'sha256'), '30000000-0000-4000-8000-00000000000a', 'ACTIVE', now()),
  ('90000000-0000-4000-8000-00000000000b', '0a000000-0000-4000-8000-000000000000', 'TP-TAXI-9B2C44',
   digest('seed-token-b', 'sha256'), null, 'UNASSIGNED', null),
  ('90000000-0000-4000-8000-00000000001a', '0b000000-0000-4000-8000-000000000000', 'TP-TAXI-1D5E77',
   digest('seed-token-c', 'sha256'), '30000000-0000-4000-8000-00000000001a', 'ACTIVE', now());

insert into tag_assignments (organization_id, nfc_tag_id, client_id) values
  ('0a000000-0000-4000-8000-000000000000', '90000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-00000000000a');

-- --- Group transport ------------------------------------------------------
-- The core scenario: one bus collects four clients at day care De Es at 16:00
-- and drops them at three different home addresses. This is what the driver
-- sees as ONE stop with four people, not four separate rides.
insert into trips (id, organization_id, name, scheduled_date, driver_id, vehicle_id,
                   status, planned_start_time, planned_start_at, planned_end_at)
values ('a1000000-0000-4000-8000-00000000000a', '0a000000-0000-4000-8000-000000000000',
        'Terugrit De Es', current_date,
        '50000000-0000-4000-8000-00000000000b', '60000000-0000-4000-8000-00000000000b',
        'ASSIGNED', '16:00',
        (current_date + time '16:00') at time zone 'Europe/Amsterdam',
        (current_date + time '17:15') at time zone 'Europe/Amsterdam');

insert into trip_stops (id, organization_id, trip_id, location_id, sequence, kind, planned_arrival_time) values
  ('a2000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000b', 1, 'PICKUP',  '16:00'),
  ('a2000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 2, 'DROPOFF', '16:25'),
  ('a2000000-0000-4000-8000-000000000003', '0a000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000c', 3, 'DROPOFF', '16:50'),
  ('a2000000-0000-4000-8000-000000000004', '0a000000-0000-4000-8000-000000000000', 'a1000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000d', 4, 'DROPOFF', '17:10');

-- Four passengers, all boarding at stop 1, alighting at stops 2, 3, 3 and 4.
-- The bus has six seats, so peak occupancy of four fits.
insert into rides (organization_id, client_id, scheduled_date, scheduled_pickup_time,
                   scheduled_pickup_at, pickup_location_id, destination_location_id,
                   driver_id, vehicle_id, status, source,
                   trip_id, pickup_stop_id, dropoff_stop_id)
values
  ('0a000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-00000000000a', current_date, '16:00',
   (current_date + time '16:00') at time zone 'Europe/Amsterdam',
   '10000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000a',
   '50000000-0000-4000-8000-00000000000b', '60000000-0000-4000-8000-00000000000b',
   'DRIVER_ASSIGNED', 'MANUAL',
   'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002'),

  ('0a000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-00000000000c', current_date, '16:00',
   (current_date + time '16:00') at time zone 'Europe/Amsterdam',
   '10000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000c',
   '50000000-0000-4000-8000-00000000000b', '60000000-0000-4000-8000-00000000000b',
   'DRIVER_ASSIGNED', 'MANUAL',
   'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003'),

  ('0a000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-00000000000d', current_date, '16:00',
   (current_date + time '16:00') at time zone 'Europe/Amsterdam',
   '10000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000c',
   '50000000-0000-4000-8000-00000000000b', '60000000-0000-4000-8000-00000000000b',
   'DRIVER_ASSIGNED', 'MANUAL',
   'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003'),

  ('0a000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-00000000000e', current_date, '16:00',
   (current_date + time '16:00') at time zone 'Europe/Amsterdam',
   '10000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000d',
   '50000000-0000-4000-8000-00000000000b', '60000000-0000-4000-8000-00000000000b',
   'DRIVER_ASSIGNED', 'MANUAL',
   'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004');

commit;
