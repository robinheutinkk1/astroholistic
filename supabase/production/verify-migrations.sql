-- Controle na het draaien van update-accounts.sql (migraties 0027, 0028, 0029).
--
-- Draai dit in de Supabase SQL Editor. Alles moet "OK" zijn. Staat er ergens
-- "MIST", dan is die migratie niet aangekomen en moet je update-accounts.sql
-- opnieuw draaien -- dat mag, het is veilig om te herhalen.

select
  '0027 - profiel bij elk nieuw account' as controle,
  case when exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created'
  ) then 'OK' else 'MIST' end as resultaat

union all
select
  '0027 - geen account zonder profiel',
  case when (
    select count(*) from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  ) = 0 then 'OK' else 'MIST - er zijn accounts zonder profielrij' end

union all
select
  '0028 - hulpfunctie voor portaalprofielen',
  case when exists (
    select 1 from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
    where n.nspname = 'app' and pr.proname = 'linked_portal_user_ids'
  ) then 'OK' else 'MIST' end

union all
select
  '0028 - planner ziet wie toegang heeft',
  case when (
    select pg_get_expr(polqual, polrelid) from pg_policy
    where polname = 'profiles_select'
  ) like '%linked_portal_user_ids%' then 'OK' else 'MIST' end

union all
-- Er wordt gezocht op de vergelijking zelf en niet op een tabelnaam: de oude,
-- lekke policy bevatte het woord "contacts" ook al (in `contact_id` en in
-- `'contacts.manage'`), dus daarop controleren zou altijd OK opleveren.
select
  '0029 - contactpersoon moet van dezelfde vervoerder zijn',
  case when (
    select pg_get_expr(polwithcheck, polrelid) from pg_policy
    where polname = 'client_contacts_insert'
  ) like '%.organization_id = c.organization_id%' then 'OK' else 'MIST - tenantlek nog open' end

union all
select
  '0029 - ook bij het wijzigen van een koppeling',
  case when (
    select pg_get_expr(polwithcheck, polrelid) from pg_policy
    where polname = 'client_contacts_update'
  ) like '%.organization_id = c.organization_id%' then 'OK' else 'MIST - tenantlek nog open' end

union all
select
  '0029 - opdrachtgever moet van dezelfde vervoerder zijn',
  case when (
    select pg_get_expr(polwithcheck, polrelid) from pg_policy
    where polname = 'client_care_organizations_insert'
  ) like '%.organization_id = c.organization_id%' then 'OK' else 'MIST - tenantlek nog open' end

order by 1;
