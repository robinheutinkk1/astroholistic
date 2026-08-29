-- ---------------------------------------------------------------------------
-- Een demo-organisatie om aan klanten te laten zien.
--
-- WAAROM. Een verse installatie is leeg, en een leeg systeem is niet te
-- demonstreren: elke lijst is leeg, het dashboard staat op nul en de
-- rapportages tonen niets. Dat ziet eruit alsof het product niet werkt, terwijl
-- er alleen nog geen gegevens in staan.
--
-- Dit vult één organisatie met verzonnen maar realistisch vervoer: zes weken
-- historie, ritten van vandaag, terugkerende afspraken, een groepsrit met vier
-- passagiers, en tags. Genoeg om elk scherm te laten zien zoals het bedoeld is.
--
-- WAT DIT NIET DOET: extra inlogaccounts aanmaken. Je eigen account wordt
-- eigenaar van de demo-organisatie, en met de organisatiekiezer bovenin schakel
-- je heen en weer. Demo-accounts met een bekend wachtwoord op een
-- productiesysteem zijn een risico dat een demo niet waard is.
--
-- Alle personen zijn verzonnen (§55). De organisatie krijgt `is_demo = true`,
-- zodat ze in rapportages en facturatie te herkennen is.
--
-- WEGHALEN: onderaan dit bestand staat één regel die alles opruimt.
-- ---------------------------------------------------------------------------

do $$
declare
  -- ======================= HIER INVULLEN =============================
  v_email    text := 'jij@jouwbedrijf.nl';   -- jouw account
  v_org_name text := 'Demo Vervoer BV';
  v_org_slug text := 'demo-vervoer';
  -- ===================================================================

  v_user      uuid;
  v_org       uuid;
  v_member    uuid;
  v_role      uuid;

  v_loc_home1 uuid; v_loc_home2 uuid; v_loc_home3 uuid; v_loc_home4 uuid;
  v_loc_dag   uuid; v_loc_school uuid;
  v_cl1 uuid; v_cl2 uuid; v_cl3 uuid; v_cl4 uuid; v_cl5 uuid;
  v_drv1 uuid; v_drv2 uuid; v_drv3 uuid;
  v_veh1 uuid; v_veh2 uuid;
  v_trip uuid; v_stop_pick uuid; v_stop_a uuid; v_stop_b uuid;
  v_contact uuid; v_care uuid;
begin
  select id into v_user from auth.users where email = v_email;
  if v_user is null then
    raise exception 'Geen account gevonden met %. Maak het eerst aan via Authentication → Users.', v_email;
  end if;

  if exists (select 1 from public.organizations where slug = v_org_slug) then
    raise exception 'Er bestaat al een organisatie met slug %. Ruim hem eerst op (zie onderaan dit bestand) of kies een andere slug.', v_org_slug;
  end if;

  -- --- De organisatie ------------------------------------------------------
  insert into public.organizations (slug, name, status, is_demo)
  values (v_org_slug, v_org_name, 'ACTIVE', true)
  returning id into v_org;

  insert into public.organization_settings (organization_id, timezone, checkout_mode)
  values (v_org, 'Europe/Amsterdam', 'OPTIONAL');

  insert into public.organization_branding (organization_id, display_name, primary_color, secondary_color, support_email)
  values (v_org, v_org_name, '#1f47d6', '#f59e0b', 'demo@voorbeeld.test');

  insert into public.retention_policies (organization_id) values (v_org);

  insert into public.profiles (id, email, full_name)
  values (v_user, v_email, coalesce((select full_name from public.profiles where id = v_user), 'Beheerder'))
  on conflict (id) do nothing;

  insert into public.organization_users (organization_id, user_id, status, joined_at)
  values (v_org, v_user, 'ACTIVE', now())
  returning id into v_member;

  select id into v_role from public.roles where key = 'owner' and is_system;
  insert into public.organization_user_roles (organization_user_id, role_id)
  values (v_member, v_role);

  -- --- Locaties ------------------------------------------------------------
  insert into public.locations (organization_id, name, kind, address_line1, postal_code, city) values
    (v_org, 'Woning Jansen',        'HOME',      'Beukstraat 12',  '7551AA', 'Hengelo')   returning id into v_loc_home1;
  insert into public.locations (organization_id, name, kind, address_line1, postal_code, city) values
    (v_org, 'Woning De Vries',      'HOME',      'Lindelaan 8',    '7511CC', 'Enschede')  returning id into v_loc_home2;
  insert into public.locations (organization_id, name, kind, address_line1, postal_code, city) values
    (v_org, 'Woning El Amrani',     'HOME',      'Marktstraat 44', '7551DD', 'Hengelo')   returning id into v_loc_home3;
  insert into public.locations (organization_id, name, kind, address_line1, postal_code, city) values
    (v_org, 'Woning Bakker',        'HOME',      'Kerkpad 2',      '7461EE', 'Rijssen')   returning id into v_loc_home4;
  insert into public.locations (organization_id, name, kind, address_line1, postal_code, city, access_notes) values
    (v_org, 'Dagbesteding De Es',   'DAY_CARE',  'Esweg 3',        '7552BB', 'Hengelo',
     'Aanbellen bij de zijingang; de hoofdingang is na 9 uur dicht.')                     returning id into v_loc_dag;
  insert into public.locations (organization_id, name, kind, address_line1, postal_code, city) values
    (v_org, 'De Sleutel (SO)',      'SCHOOL',    'Schoolstraat 9', '7553FF', 'Hengelo')   returning id into v_loc_school;

  -- --- Cliënten ------------------------------------------------------------
  insert into public.clients (organization_id, first_name, last_name, city, home_location_id, external_reference) values
    (v_org, 'Jan',    'Jansen',    'Hengelo',  v_loc_home1, 'DEMO-001') returning id into v_cl1;
  insert into public.clients (organization_id, first_name, last_name, city, home_location_id, external_reference) values
    (v_org, 'Piet',   'de Vries',  'Enschede', v_loc_home2, 'DEMO-002') returning id into v_cl2;
  insert into public.clients (organization_id, first_name, last_name, city, home_location_id, external_reference) values
    (v_org, 'Fatima', 'El Amrani', 'Hengelo',  v_loc_home3, 'DEMO-003') returning id into v_cl3;
  insert into public.clients (organization_id, first_name, last_name, city, home_location_id, external_reference) values
    (v_org, 'Sem',    'Bakker',    'Rijssen',  v_loc_home4, 'DEMO-004') returning id into v_cl4;
  insert into public.clients (organization_id, first_name, last_name, city, external_reference) values
    (v_org, 'Noor',   'Visser',    'Hengelo',  'DEMO-005') returning id into v_cl5;

  -- Een ouder en een opdrachtgever, zodat de portalen ook iets te tonen hebben.
  insert into public.contacts (organization_id, first_name, last_name, phone)
  values (v_org, 'Olga', 'Jansen', '06-12345678') returning id into v_contact;

  insert into public.client_contacts (client_id, contact_id, relationship, is_primary, can_view_rides, can_report_absence)
  values (v_cl1, v_contact, 'moeder', true, true, true);

  insert into public.care_organizations (organization_id, name, contact_email)
  values (v_org, 'Zorginstelling De Brug', 'vervoer@debrug.test') returning id into v_care;

  -- Twee vestigingen onder één opdrachtgever, want dat is hoe het in het echt
  -- werkt: de rapportage kan dan filteren op de opdrachtgever als geheel en
  -- daarna uitsplitsen per vestiging.
  update public.locations set care_organization_id = v_care
  where id in (v_loc_dag, v_loc_school);

  insert into public.client_care_organizations (client_id, care_organization_id, valid_from)
  values (v_cl1, v_care, current_date - 365), (v_cl3, v_care, current_date - 200);

  -- --- Chauffeurs en voertuigen -------------------------------------------
  insert into public.drivers (organization_id, employee_number, first_name, last_name) values
    (v_org, 'D-01', 'Kees',  'Bosman')   returning id into v_drv1;
  insert into public.drivers (organization_id, employee_number, first_name, last_name) values
    (v_org, 'D-02', 'Sanne', 'de Wit')   returning id into v_drv2;
  insert into public.drivers (organization_id, employee_number, first_name, last_name) values
    (v_org, 'D-03', 'Ruud',  'Peters')   returning id into v_drv3;

  insert into public.vehicles (organization_id, license_plate, make, model, seats, wheelchair_positions, is_wheelchair_accessible) values
    (v_org, '12-ABC-3', 'Mercedes', 'Sprinter', 8, 2, true) returning id into v_veh1;
  insert into public.vehicles (organization_id, license_plate, make, model, seats, wheelchair_positions, is_wheelchair_accessible) values
    (v_org, '45-DEF-6', 'Ford',     'Tourneo',  6, 0, false) returning id into v_veh2;

  insert into public.driver_vehicles (driver_id, vehicle_id, is_default) values
    (v_drv1, v_veh1, true), (v_drv2, v_veh2, true);

  -- --- Terugkerende afspraken ---------------------------------------------
  insert into public.ride_templates
    (organization_id, client_id, name, pickup_location_id, destination_location_id,
     departure_time, days_of_week, starts_on, default_driver_id, default_vehicle_id, transport_requirements)
  values
    (v_org, v_cl1, 'Heenrit dagbesteding', v_loc_home1, v_loc_dag, '08:00',
     array[1,2,3,4,5]::smallint[], current_date - 42, v_drv1, v_veh1,
     array['WHEELCHAIR']::transport_requirement[]),
    (v_org, v_cl1, 'Terugrit dagbesteding', v_loc_dag, v_loc_home1, '16:00',
     array[1,2,3,4,5]::smallint[], current_date - 42, v_drv1, v_veh1,
     array['WHEELCHAIR']::transport_requirement[]),
    (v_org, v_cl4, 'Heenrit school', v_loc_home4, v_loc_school, '07:45',
     array[1,2,3,4,5]::smallint[], current_date - 42, v_drv2, v_veh2, '{}');

  -- --- Zes weken historie --------------------------------------------------
  --
  -- Deterministisch op het dagnummer, niet willekeurig: dan ziet iedereen die
  -- de demo opent dezelfde cijfers, en kloppen de rapportages met wat je
  -- vertelt. Niet alles gaat goed, want een rapportage waarin nooit iets
  -- misgaat laat niet zien waar het product voor is.
  insert into public.rides
    (organization_id, client_id, scheduled_date, scheduled_pickup_time, scheduled_pickup_at,
     pickup_location_id, destination_location_id, driver_id, vehicle_id, status, source,
     checked_in_at, checked_in_method, completed_at, absence_reason)
  select
    v_org, h.client, h.day, h.tijd,
    (h.day + h.tijd) at time zone 'Europe/Amsterdam',
    h.van, h.naar,
    case when h.status = 'CANCELLED' then null else h.driver end,
    case when h.status = 'CANCELLED' then null else h.vehicle end,
    h.status, 'TEMPLATE',
    case when h.status = 'COMPLETED'
      then (h.day + h.tijd) at time zone 'Europe/Amsterdam' + make_interval(mins => h.vertraging::int) end,
    case when h.status = 'COMPLETED' then h.methode end,
    case when h.status = 'COMPLETED'
      then (h.day + h.tijd) at time zone 'Europe/Amsterdam' + interval '35 minutes' end,
    case when h.status = 'CLIENT_ABSENT' then h.reden end
  from (
    select
      b.client, b.van, b.naar, b.driver, b.vehicle, b.tijd, d.day,
      case (d.n + b.variant) % 12
        when 0 then 'CLIENT_ABSENT' when 5 then 'CLIENT_ABSENT'
        when 9 then 'CANCELLED' else 'COMPLETED'
      end::public.ride_status as status,
      case (d.n + b.variant) % 12 when 0 then 'ILL' else 'NOT_HOME' end::public.absence_reason as reden,
      case (d.n + b.variant) % 3 when 0 then 'NFC' when 1 then 'QR' else 'MANUAL' end::public.event_source as methode,
      ((d.n + b.variant) % 11) - 2 as vertraging
    from (
      select day, row_number() over (order by day) as n
      from generate_series(current_date - 42, current_date - 1, interval '1 day') as g(day)
      where extract(isodow from g.day) < 6
    ) d
    cross join (values
      (v_cl1, v_loc_home1, v_loc_dag,    v_drv1, v_veh1, time '08:00', 0),
      (v_cl1, v_loc_dag,   v_loc_home1,  v_drv1, v_veh1, time '16:00', 3),
      (v_cl4, v_loc_home4, v_loc_school, v_drv2, v_veh2, time '07:45', 6),
      (v_cl2, v_loc_home2, v_loc_dag,    v_drv2, v_veh2, time '08:30', 9)
    ) as b(client, van, naar, driver, vehicle, tijd, variant)
  ) h;

  -- --- Vandaag: ritten in verschillende stadia ----------------------------
  insert into public.rides
    (organization_id, client_id, scheduled_date, scheduled_pickup_time, scheduled_pickup_at,
     pickup_location_id, destination_location_id, driver_id, vehicle_id, status, source, transport_requirements)
  values
    (v_org, v_cl1, current_date, '08:00', (current_date + time '08:00') at time zone 'Europe/Amsterdam',
     v_loc_home1, v_loc_dag, v_drv1, v_veh1, 'DRIVER_ARRIVED', 'TEMPLATE', array['WHEELCHAIR']::transport_requirement[]),
    (v_org, v_cl4, current_date, '07:45', (current_date + time '07:45') at time zone 'Europe/Amsterdam',
     v_loc_home4, v_loc_school, v_drv2, v_veh2, 'DRIVER_EN_ROUTE', 'TEMPLATE', '{}'),
    (v_org, v_cl2, current_date, '08:30', (current_date + time '08:30') at time zone 'Europe/Amsterdam',
     v_loc_home2, v_loc_dag, v_drv2, v_veh2, 'DRIVER_ASSIGNED', 'MANUAL', '{}'),
    (v_org, v_cl3, current_date, '09:15', (current_date + time '09:15') at time zone 'Europe/Amsterdam',
     v_loc_home3, v_loc_dag, null, null, 'SCHEDULED', 'MANUAL', '{}'),
    (v_org, v_cl5, current_date, '10:00', (current_date + time '10:00') at time zone 'Europe/Amsterdam',
     v_loc_home1, v_loc_dag, null, null, 'SCHEDULED', 'MANUAL', '{}');

  -- --- Morgen, zodat de planning vooruit ook gevuld is ---------------------
  insert into public.rides
    (organization_id, client_id, scheduled_date, scheduled_pickup_time, scheduled_pickup_at,
     pickup_location_id, destination_location_id, driver_id, vehicle_id, status, source)
  select v_org, b.client, d.day, b.tijd,
         (d.day + b.tijd) at time zone 'Europe/Amsterdam',
         b.van, b.naar, b.driver, b.vehicle, 'SCHEDULED', 'TEMPLATE'
  from generate_series(current_date + 1, current_date + 14, interval '1 day') as d(day)
  cross join (values
    (v_cl1, v_loc_home1, v_loc_dag,    v_drv1, v_veh1, time '08:00'),
    (v_cl4, v_loc_home4, v_loc_school, v_drv2, v_veh2, time '07:45')
  ) as b(client, van, naar, driver, vehicle, tijd)
  where extract(isodow from d.day) < 6;

  -- --- Een groepsrit vanmiddag --------------------------------------------
  --
  -- Het geval waar dit product voor gemaakt is: vier cliënten bij één locatie,
  -- één bus, één keer "aangekomen" drukken en dan iedereen los afvinken.
  insert into public.trips
    (organization_id, name, scheduled_date, driver_id, vehicle_id, status,
     planned_start_time, planned_start_at, planned_end_at)
  values (v_org, 'Terugrit De Es', current_date, v_drv2, v_veh1, 'ASSIGNED', '16:00',
          (current_date + time '16:00') at time zone 'Europe/Amsterdam',
          (current_date + time '17:15') at time zone 'Europe/Amsterdam')
  returning id into v_trip;

  insert into public.trip_stops (organization_id, trip_id, location_id, sequence, kind, planned_arrival_time)
  values (v_org, v_trip, v_loc_dag, 1, 'PICKUP', '16:00') returning id into v_stop_pick;
  insert into public.trip_stops (organization_id, trip_id, location_id, sequence, kind, planned_arrival_time)
  values (v_org, v_trip, v_loc_home1, 2, 'DROPOFF', '16:25') returning id into v_stop_a;
  insert into public.trip_stops (organization_id, trip_id, location_id, sequence, kind, planned_arrival_time)
  values (v_org, v_trip, v_loc_home3, 3, 'DROPOFF', '16:50') returning id into v_stop_b;

  insert into public.rides
    (organization_id, client_id, scheduled_date, scheduled_pickup_time, scheduled_pickup_at,
     pickup_location_id, destination_location_id, driver_id, vehicle_id, status, source,
     trip_id, pickup_stop_id, dropoff_stop_id)
  values
    (v_org, v_cl1, current_date, '16:00', (current_date + time '16:00') at time zone 'Europe/Amsterdam',
     v_loc_dag, v_loc_home1, v_drv2, v_veh1, 'DRIVER_ASSIGNED', 'MANUAL', v_trip, v_stop_pick, v_stop_a),
    (v_org, v_cl3, current_date, '16:00', (current_date + time '16:00') at time zone 'Europe/Amsterdam',
     v_loc_dag, v_loc_home3, v_drv2, v_veh1, 'DRIVER_ASSIGNED', 'MANUAL', v_trip, v_stop_pick, v_stop_b),
    (v_org, v_cl5, current_date, '16:00', (current_date + time '16:00') at time zone 'Europe/Amsterdam',
     v_loc_dag, v_loc_home1, v_drv2, v_veh1, 'DRIVER_ASSIGNED', 'MANUAL', v_trip, v_stop_pick, v_stop_a),
    (v_org, v_cl2, current_date, '16:00', (current_date + time '16:00') at time zone 'Europe/Amsterdam',
     v_loc_dag, v_loc_home3, v_drv2, v_veh1, 'DRIVER_ASSIGNED', 'MANUAL', v_trip, v_stop_pick, v_stop_b);

  raise notice 'Demo-organisatie "%" klaar. Wissel bovenin van organisatie om hem te bekijken.', v_org_name;
end
$$;

-- Wat er nu staat.
select
  o.name                                                              as organisatie,
  (select count(*) from public.clients  c where c.organization_id = o.id) as clienten,
  (select count(*) from public.drivers  d where d.organization_id = o.id) as chauffeurs,
  (select count(*) from public.rides    r where r.organization_id = o.id) as ritten,
  (select count(*) from public.trips    t where t.organization_id = o.id) as groepsritten
from public.organizations o
where o.is_demo;

-- ---------------------------------------------------------------------------
-- OPRUIMEN. Eén regel, en de hele demo-organisatie is weg — alles hangt met
-- `on delete cascade` aan de organisatie. Je eigen organisatie blijft staan.
--
--   delete from public.organizations where slug = 'demo-vervoer';
-- ---------------------------------------------------------------------------
