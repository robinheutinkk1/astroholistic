-- ---------------------------------------------------------------------------
-- Eerste organisatie en eerste beheerder.
--
-- WAAROM DIT BESTAAT. Na de migraties is de database leeg en er is met opzet
-- geen registratiepagina: organisaties worden door het platform aangemaakt, niet
-- door henzelf (docs/SECURITY.md — `organizations` heeft geen INSERT-policy voor
-- tenants). Zonder dit script heb je dus een werkende site waar niemand in kan.
--
-- Dit is een eenmalige handeling per nieuwe klant, uit te voeren in de SQL
-- Editor van Supabase. Hij is veilig om twee keer te draaien: bestaat er al
-- iets, dan laat hij het staan.
--
-- VOORAF: maak het account aan in Supabase onder Authentication → Users →
-- "Add user" → "Create new user". Vul e-mailadres en wachtwoord in en vink
-- "Auto Confirm User" aan, anders kan er niet worden ingelogd.
-- ---------------------------------------------------------------------------

do $$
declare
  -- ======================= HIER INVULLEN =============================
  v_email       text := 'jij@jouwbedrijf.nl';   -- het account uit Authentication → Users
  v_full_name   text := 'Jouw Naam';
  v_org_name    text := 'Taxi Ontzorgd';        -- zoals de klant heet
  v_org_slug    text := 'taxi-ontzorgd';        -- kleine letters, cijfers, streepjes
  v_timezone    text := 'Europe/Amsterdam';
  -- ===================================================================

  v_user_id     uuid;
  v_org_id      uuid;
  v_member_id   uuid;
  v_role_id     uuid;
begin
  -- 1. Het account moet al bestaan. Aanmaken kan hier niet: auth.users is van
  --    Supabase en wordt via het dashboard of de API beheerd.
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    raise exception
      'Geen account gevonden met e-mailadres %. Maak het eerst aan via Authentication → Users → Add user, met "Auto Confirm User" aan.',
      v_email;
  end if;

  -- 2. Profiel. Dit is de applicatiekant van het account; auth.users is de
  --    inlogkant. Ze staan los van elkaar zodat een uitgenodigde gebruiker een
  --    profiel kan hebben voordat hij ooit heeft ingelogd.
  insert into public.profiles (id, email, full_name)
  values (v_user_id, v_email, v_full_name)
  on conflict (id) do update set email = excluded.email;

  -- 3. De organisatie zelf.
  select id into v_org_id from public.organizations where slug = v_org_slug;
  if v_org_id is null then
    insert into public.organizations (slug, name, status, is_demo)
    values (v_org_slug, v_org_name, 'ACTIVE', false)
    returning id into v_org_id;
  end if;

  -- 4. De bijbehorende rijen. Zonder settings weet het product niet in welke
  --    tijdzone een rit van 08:00 valt, en dat is geen detail: dan staan de
  --    ritten op de verkeerde dag.
  insert into public.organization_settings (organization_id, timezone)
  values (v_org_id, v_timezone)
  on conflict (organization_id) do nothing;

  insert into public.organization_branding (organization_id, display_name)
  values (v_org_id, v_org_name)
  on conflict (organization_id) do nothing;

  insert into public.retention_policies (organization_id)
  values (v_org_id)
  on conflict (organization_id) do nothing;

  -- 5. Het lidmaatschap.
  select id into v_member_id
  from public.organization_users
  where organization_id = v_org_id and user_id = v_user_id;

  if v_member_id is null then
    insert into public.organization_users (organization_id, user_id, status, joined_at)
    values (v_org_id, v_user_id, 'ACTIVE', now())
    returning id into v_member_id;
  end if;

  -- 6. De eigenaarsrol. `owner` is een systeemrol uit migratie 0013 en hangt
  --    aan geen enkele organisatie, dus hij is voor iedereen dezelfde rij.
  select id into v_role_id from public.roles where key = 'owner' and is_system;
  if v_role_id is null then
    raise exception
      'Systeemrol "owner" ontbreekt. Zijn alle migraties gedraaid? Controleer of migratie 0013 is uitgevoerd.';
  end if;

  insert into public.organization_user_roles (organization_user_id, role_id)
  values (v_member_id, v_role_id)
  on conflict do nothing;

  raise notice 'Klaar. Organisatie "%" aangemaakt en % is eigenaar. Inloggen kan nu.',
    v_org_name, v_email;
end
$$;

-- Controle achteraf: één rij, met jouw naam en de rol owner.
select
  o.name        as organisatie,
  p.email       as beheerder,
  r.key         as rol,
  ou.status     as lidmaatschap
from public.organization_users ou
join public.organizations o on o.id = ou.organization_id
join public.profiles p on p.id = ou.user_id
join public.organization_user_roles our on our.organization_user_id = ou.id
join public.roles r on r.id = our.role_id;
