-- ---------------------------------------------------------------------------
-- 0027 — Een profiel bij elk account.
--
-- HET GAT. `profiles` is de applicatiekant van een account; `auth.users` is de
-- inlogkant. Er was niets dat de eerste aanmaakte als de tweede ontstond. Wie
-- een gebruiker toevoegde via het Supabase-dashboard kreeg dus een account dat
-- kon inloggen en verder nergens bestond: geen naam, geen lidmaatschap, geen
-- rol. Elk scherm dat een profiel opzoekt gaf niets terug.
--
-- Dat viel niet op omdat de seed beide tabellen zelf vulde, en omdat de enige
-- accounts tot nu toe met de hand waren aangemaakt.
--
-- WAAROM EEN TRIGGER EN GEEN CODE. Een account kan op vier manieren ontstaan:
-- het dashboard, de admin-API, een uitnodiging, en zelfregistratie als die er
-- ooit komt. Alleen de database ziet ze alle vier.
-- ---------------------------------------------------------------------------

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    -- Supabase zet wat er bij het uitnodigen is meegegeven in raw_user_meta_data.
    -- Ontbreekt het, dan blijft de naam leeg tot de gebruiker hem zelf invult;
    -- het e-mailadres verzinnen als naam maakt lijsten onleesbaar.
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Op auth.users, niet op profiles: dit is precies het moment dat we willen
-- afvangen. Het is de standaardmanier waarop Supabase-projecten dit doen.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- Accounts die al bestonden voordat de trigger er was. Zonder deze regel blijft
-- iedereen die eerder met de hand is aangemaakt onzichtbaar in de applicatie.
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
