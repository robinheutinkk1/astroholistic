-- Rapportages filteren op opdrachtgever en locatie.
--
-- De vraag die een planner stelt is zelden "hoeveel ritten reden we". Het is
-- "hoeveel ritten reden we voor Humankind", en daarna "en hoe verdeelt zich dat
-- over Enschede en Hengelo". Zonder filter moest dat met de hand uit een export.
--
-- WAT "VOOR EEN OPDRACHTGEVER" BETEKENT. Een rit telt mee als de ophaal- óf de
-- bestemmingslocatie een vestiging van die opdrachtgever is. Niet alleen de
-- bestemming: het ophalen ná de dagbesteding is net zo goed een rit voor die
-- opdrachtgever, en die zou anders wegvallen uit precies de helft van de cijfers.
--
-- De parameters staan achteraan met een standaardwaarde, zodat elke bestaande
-- aanroep met drie argumenten blijft werken.

-- EERST WEG, DAN OPNIEUW. `create or replace` met een extra parameter vervangt
-- niets: het maakt een tweede versie naast de oude. Postgres kan daarna niet
-- kiezen ("function is not unique") en een aanroep met drie argumenten zou de
-- ongefilterde versie treffen. Dat is precies de fout die je pas ontdekt als
-- een klant cijfers van een andere opdrachtgever op zijn factuur ziet.
drop function if exists public.report_ride_summary(uuid, date, date);
drop function if exists public.report_rides_per_day(uuid, date, date);
drop function if exists public.report_by_driver(uuid, date, date);
drop function if exists public.report_by_client(uuid, date, date);
drop function if exists public.report_absence_reasons(uuid, date, date);

-- Eén plek waar de filterregel staat. Hem in vijf functies herhalen betekent
-- vijf kansen om er één te vergeten bij de volgende wijziging.
create or replace function app.ride_matches_scope(
  p_pickup_location_id uuid,
  p_destination_location_id uuid,
  p_care_organization_id uuid,
  p_location_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (
      p_location_id is null
      or p_pickup_location_id = p_location_id
      or p_destination_location_id = p_location_id
    )
    and (
      p_care_organization_id is null
      or exists (
        select 1 from public.locations l
        where l.care_organization_id = p_care_organization_id
          and l.id in (p_pickup_location_id, p_destination_location_id)
      )
    );
$$;

comment on function app.ride_matches_scope(uuid, uuid, uuid, uuid) is
  'Valt deze rit binnen het gekozen filter? Een lege filterwaarde laat alles door.';

-- --- 1. Samenvatting ------------------------------------------------------
create or replace function public.report_ride_summary(
  p_organization_id uuid,
  p_from date,
  p_to date,
  p_care_organization_id uuid default null,
  p_location_id uuid default null
)
returns table (
  total bigint,
  completed bigint,
  cancelled bigint,
  absent bigint,
  problem bigint,
  open bigint,
  checkin_nfc bigint,
  checkin_qr bigint,
  checkin_manual bigint,
  measured bigint,
  on_time bigint,
  late bigint,
  avg_delay_seconds numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)                                                          as total,
    count(*) filter (where r.status = 'COMPLETED')                    as completed,
    count(*) filter (where r.status = 'CANCELLED')                    as cancelled,
    count(*) filter (where r.status = 'CLIENT_ABSENT')                as absent,
    count(*) filter (where r.status = 'PROBLEM')                      as problem,
    count(*) filter (
      where r.status not in ('COMPLETED', 'CANCELLED', 'CLIENT_ABSENT', 'PROBLEM')
    )                                                                 as open,
    count(*) filter (where r.checked_in_method = 'NFC')               as checkin_nfc,
    count(*) filter (where r.checked_in_method = 'QR')                as checkin_qr,
    count(*) filter (where r.checked_in_method = 'MANUAL')            as checkin_manual,
    count(*) filter (where r.checked_in_at is not null)               as measured,
    count(*) filter (
      where r.checked_in_at is not null
        and r.checked_in_at <= r.scheduled_pickup_at + app.punctuality_grace()
    )                                                                 as on_time,
    count(*) filter (
      where r.checked_in_at is not null
        and r.checked_in_at > r.scheduled_pickup_at + app.punctuality_grace()
    )                                                                 as late,
    avg(extract(epoch from (r.checked_in_at - r.scheduled_pickup_at)))
      filter (where r.checked_in_at is not null)                      as avg_delay_seconds
  from public.rides r
  where r.organization_id = p_organization_id
    and r.scheduled_date between p_from and p_to
    and app.ride_matches_scope(
      r.pickup_location_id, r.destination_location_id,
      p_care_organization_id, p_location_id)
    and app.has_permission(p_organization_id, 'reports.view');
$$;

-- --- 2. Ritten per dag ----------------------------------------------------
create or replace function public.report_rides_per_day(
  p_organization_id uuid,
  p_from date,
  p_to date,
  p_care_organization_id uuid default null,
  p_location_id uuid default null
)
returns table (
  day date,
  total bigint,
  completed bigint,
  absent bigint,
  cancelled bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.scheduled_date                                    as day,
    count(*)                                            as total,
    count(*) filter (where r.status = 'COMPLETED')      as completed,
    count(*) filter (where r.status = 'CLIENT_ABSENT')  as absent,
    count(*) filter (where r.status = 'CANCELLED')      as cancelled
  from public.rides r
  where r.organization_id = p_organization_id
    and r.scheduled_date between p_from and p_to
    and app.ride_matches_scope(
      r.pickup_location_id, r.destination_location_id,
      p_care_organization_id, p_location_id)
    and app.has_permission(p_organization_id, 'reports.view')
  group by r.scheduled_date
  order by r.scheduled_date;
$$;

-- --- 3. Per chauffeur -----------------------------------------------------
create or replace function public.report_by_driver(
  p_organization_id uuid,
  p_from date,
  p_to date,
  p_care_organization_id uuid default null,
  p_location_id uuid default null
)
returns table (
  driver_id uuid,
  driver_name text,
  total bigint,
  completed bigint,
  absent bigint,
  measured bigint,
  on_time bigint,
  avg_delay_seconds numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.driver_id,
    max(d.first_name || ' ' || d.last_name)                           as driver_name,
    count(*)                                                          as total,
    count(*) filter (where r.status = 'COMPLETED')                    as completed,
    count(*) filter (where r.status = 'CLIENT_ABSENT')                as absent,
    count(*) filter (where r.checked_in_at is not null)               as measured,
    count(*) filter (
      where r.checked_in_at is not null
        and r.checked_in_at <= r.scheduled_pickup_at + app.punctuality_grace()
    )                                                                 as on_time,
    avg(extract(epoch from (r.checked_in_at - r.scheduled_pickup_at)))
      filter (where r.checked_in_at is not null)                      as avg_delay_seconds
  from public.rides r
  left join public.drivers d on d.id = r.driver_id
  where r.organization_id = p_organization_id
    and r.scheduled_date between p_from and p_to
    and app.ride_matches_scope(
      r.pickup_location_id, r.destination_location_id,
      p_care_organization_id, p_location_id)
    and app.has_permission(p_organization_id, 'reports.view')
  group by r.driver_id
  order by count(*) desc, r.driver_id;
$$;

-- --- 4. Per cliënt --------------------------------------------------------
create or replace function public.report_by_client(
  p_organization_id uuid,
  p_from date,
  p_to date,
  p_care_organization_id uuid default null,
  p_location_id uuid default null
)
returns table (
  client_id uuid,
  client_name text,
  total bigint,
  completed bigint,
  absent bigint,
  cancelled bigint,
  last_ride_date date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.client_id,
    max(c.first_name || ' ' || c.last_name)             as client_name,
    count(*)                                            as total,
    count(*) filter (where r.status = 'COMPLETED')      as completed,
    count(*) filter (where r.status = 'CLIENT_ABSENT')  as absent,
    count(*) filter (where r.status = 'CANCELLED')      as cancelled,
    max(r.scheduled_date)                               as last_ride_date
  from public.rides r
  left join public.clients c on c.id = r.client_id
  where r.organization_id = p_organization_id
    and r.scheduled_date between p_from and p_to
    and app.ride_matches_scope(
      r.pickup_location_id, r.destination_location_id,
      p_care_organization_id, p_location_id)
    and app.has_permission(p_organization_id, 'reports.view')
  group by r.client_id
  order by count(*) desc, r.client_id;
$$;

-- --- 5. Waarom ritten niet doorgaan ---------------------------------------
create or replace function public.report_absence_reasons(
  p_organization_id uuid,
  p_from date,
  p_to date,
  p_care_organization_id uuid default null,
  p_location_id uuid default null
)
returns table (
  reason public.absence_reason,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.absence_reason as reason, count(*) as total
  from public.rides r
  where r.organization_id = p_organization_id
    and r.scheduled_date between p_from and p_to
    and r.status = 'CLIENT_ABSENT'
    and app.ride_matches_scope(
      r.pickup_location_id, r.destination_location_id,
      p_care_organization_id, p_location_id)
    and app.has_permission(p_organization_id, 'reports.view')
  group by r.absence_reason
  order by count(*) desc, r.absence_reason;
$$;

-- --- 6. Per locatie, nieuw ------------------------------------------------
--
-- Het antwoord op "en hoe verdeelt Humankind zich over de vestigingen". Een rit
-- telt bij de locatie waar hij vandaan komt én bij waar hij heen gaat, dus de
-- som van de regels is hoger dan het totaal. Dat is geen fout maar de vraag:
-- hoe druk is deze vestiging.
--
-- Is er een opdrachtgever gekozen, dan blijven alleen diens vestigingen over.
create or replace function public.report_by_location(
  p_organization_id uuid,
  p_from date,
  p_to date,
  p_care_organization_id uuid default null,
  p_location_id uuid default null
)
returns table (
  location_id uuid,
  location_name text,
  care_organization_id uuid,
  care_organization_name text,
  total bigint,
  completed bigint,
  absent bigint,
  cancelled bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with touched as (
    select r.pickup_location_id as location_id, r.status
    from public.rides r
    where r.organization_id = p_organization_id
      and r.scheduled_date between p_from and p_to
      and r.pickup_location_id is not null
      and app.ride_matches_scope(
        r.pickup_location_id, r.destination_location_id,
        p_care_organization_id, p_location_id)
    union all
    select r.destination_location_id, r.status
    from public.rides r
    where r.organization_id = p_organization_id
      and r.scheduled_date between p_from and p_to
      and r.destination_location_id is not null
      and app.ride_matches_scope(
        r.pickup_location_id, r.destination_location_id,
        p_care_organization_id, p_location_id)
  )
  select
    t.location_id,
    max(l.name)                                         as location_name,
    -- Postgres kent geen max() voor uuid. De groepering is per locatie, dus
    -- elke rij in de groep heeft dezelfde opdrachtgever, dus de eerste volstaat.
    (array_agg(l.care_organization_id))[1]              as care_organization_id,
    max(co.name)                                        as care_organization_name,
    count(*)                                            as total,
    count(*) filter (where t.status = 'COMPLETED')      as completed,
    count(*) filter (where t.status = 'CLIENT_ABSENT')  as absent,
    count(*) filter (where t.status = 'CANCELLED')      as cancelled
  from touched t
  left join public.locations l on l.id = t.location_id
  left join public.care_organizations co on co.id = l.care_organization_id
  where app.has_permission(p_organization_id, 'reports.view')
    -- Bij een gekozen opdrachtgever alleen diens eigen vestigingen. Elke rit
    -- raakt twee locaties, dus zonder deze regel zou "Humankind, per locatie"
    -- ook alle woonadressen tonen waar die ritten vandaan komen. Dat is een
    -- ander antwoord dan de vraag "hoe verdeelt Humankind zich over Enschede
    -- en Hengelo".
    and (p_care_organization_id is null or l.care_organization_id = p_care_organization_id)
  group by t.location_id
  order by count(*) desc, t.location_id;
$$;

-- De rechten opnieuw, want die zijn met de oude functies meeverdwenen. De
-- `security invoker`-functies draaien onder de rechten van de aanroeper, dus
-- RLS blijft gelden; dit bepaalt alleen wie ze mag aanroepen.
grant execute on function app.ride_matches_scope(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.report_ride_summary(uuid, date, date, uuid, uuid) to authenticated;
grant execute on function public.report_rides_per_day(uuid, date, date, uuid, uuid) to authenticated;
grant execute on function public.report_by_driver(uuid, date, date, uuid, uuid) to authenticated;
grant execute on function public.report_by_client(uuid, date, date, uuid, uuid) to authenticated;
grant execute on function public.report_absence_reasons(uuid, date, date, uuid, uuid) to authenticated;
grant execute on function public.report_by_location(uuid, date, date, uuid, uuid) to authenticated;
