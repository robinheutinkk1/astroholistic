-- Een koppeling mag de tenantgrens niet oversteken.
--
-- HET GAT. De policies op `client_contacts` en `client_care_organizations`
-- controleerden alleen of de *cliënt* van jouw organisatie was. Over de
-- contactpersoon of de zorgorganisatie aan de andere kant van de koppeling
-- zeiden ze niets. Een planner van vervoerder A kon dus een contactpersoon van
-- vervoerder B aan zijn eigen cliënt hangen — en omdat `app.visible_client_ids()`
-- die koppeling leest, kreeg de portaalgebruiker van die vreemde
-- contactpersoon daarmee de ritten van een cliënt van A te zien.
--
-- Dat het een insider vereist maakt het niet minder erg: het uitgangspunt van
-- dit product is dat de database de scheiding bewaakt en niet het scherm. Een
-- verkeerd id uit een gekopieerde URL of een importscript is genoeg.
--
-- Geconstateerd tijdens het bouwen van de beheerschermen voor contactpersonen
-- en zorgorganisaties (S78-S79).

drop policy client_contacts_insert on client_contacts;
drop policy client_contacts_update on client_contacts;

create policy client_contacts_insert on client_contacts for insert to authenticated
with check (
  exists (
    select 1
    from clients c
    join contacts ct on ct.id = client_contacts.contact_id
    where c.id = client_contacts.client_id
      and c.organization_id = any ((select app.permitted_org_ids('contacts.manage'))::uuid[])
      -- De kern van deze migratie: allebei de kanten in dezelfde organisatie.
      and ct.organization_id = c.organization_id
  )
);

create policy client_contacts_update on client_contacts for update to authenticated
using (
  exists (
    select 1
    from clients c
    where c.id = client_contacts.client_id
      and c.organization_id = any ((select app.permitted_org_ids('contacts.manage'))::uuid[])
  )
)
with check (
  exists (
    select 1
    from clients c
    join contacts ct on ct.id = client_contacts.contact_id
    where c.id = client_contacts.client_id
      and c.organization_id = any ((select app.permitted_org_ids('contacts.manage'))::uuid[])
      and ct.organization_id = c.organization_id
  )
);

drop policy client_care_organizations_insert on client_care_organizations;

create policy client_care_organizations_insert on client_care_organizations
for insert to authenticated
with check (
  exists (
    select 1
    from clients c
    join care_organizations co on co.id = client_care_organizations.care_organization_id
    where c.id = client_care_organizations.client_id
      and c.organization_id = any ((select app.permitted_org_ids('care_organizations.manage'))::uuid[])
      and co.organization_id = c.organization_id
  )
);

-- `client_care_organizations` had geen update-policy en krijgt die ook niet:
-- een geldigheidsperiode aanpassen gebeurt door de oude rij te verwijderen en
-- een nieuwe te maken, zodat de geschiedenis van wie wanneer betaalde intact
-- blijft.
