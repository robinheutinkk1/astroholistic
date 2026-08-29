-- Portaaltoegang zichtbaar maken voor wie hem uitdeelt.
--
-- Een planner koppelt een e-mailadres aan een cliënt of een contactpersoon en
-- moet daarna kunnen zien wélk adres dat is: dat is niet alleen prettig maar
-- ook een verplichting, want de vervoerder is verwerkingsverantwoordelijke en
-- moet kunnen aantonen wie bij welke gegevens kan.
--
-- Tot nu toe kon dat niet. `profiles_select` liet alleen jezelf zien en de
-- mensen die lid zijn van dezelfde organisatie, en een portaalgebruiker is
-- juist géén lid — dat is precies waarom hij geen permissies heeft. Het gevolg
-- was dat het scherm "heeft toegang" kon tonen maar nooit "wie".
--
-- Deze migratie maakt dat gat zo klein mogelijk: alleen de profielen die via
-- een cliënt-, contact- of zorgorganisatiekoppeling aan jouw organisatie
-- hangen, en alleen als je de bijbehorende leesrechten hebt.

create or replace function app.linked_portal_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct user_id), '{}')
  from (
    -- De cliënt die zelf inlogt.
    select c.user_id
    from public.clients c
    where c.user_id is not null
      and c.organization_id = any (app.permitted_org_ids('clients.view'))

    union all

    -- De ouder, mantelzorger of andere contactpersoon.
    select ct.user_id
    from public.contacts ct
    where ct.user_id is not null
      and ct.organization_id = any (app.permitted_org_ids('contacts.view'))

    union all

    -- De medewerker van een zorgorganisatie die deze vervoerder inzet.
    select cou.user_id
    from public.care_organization_users cou
    join public.care_organizations co on co.id = cou.care_organization_id
    where co.organization_id = any (app.permitted_org_ids('care_organizations.view'))
  ) as linked;
$$;

comment on function app.linked_portal_user_ids() is
  'Profiel-ids van portaalgebruikers die aan een cliënt, contactpersoon of zorgorganisatie van de beller hangen. Alleen bedoeld voor profiles_select.';

revoke all on function app.linked_portal_user_ids() from public;
grant execute on function app.linked_portal_user_ids() to authenticated;

drop policy profiles_select on profiles;

create policy profiles_select on profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1 from organization_users ou
    where ou.user_id = profiles.id
      and ou.organization_id = any ((select app.member_org_ids())::uuid[])
  )
  -- De cast is verplicht: zonder `::uuid[]` leest Postgres `= any (subquery)`
  -- als de rijvorm en klaagt over het type.
  or id = any ((select app.linked_portal_user_ids())::uuid[])
);
