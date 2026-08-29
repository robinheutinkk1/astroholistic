-- Een opdrachtgever heeft meerdere locaties.
--
-- Humankind is één opdrachtgever met vestigingen in Enschede, Hengelo en
-- Almelo. Tot nu toe stonden die drie in `locations` als losse adressen zonder
-- enig verband, en was de vraag "hoeveel ritten reden we voor Humankind?" niet
-- te beantwoorden: je moest zelf weten welke locaties bij elkaar hoorden.
--
-- De koppeling is optioneel. Een woonadres, een station of een ziekenhuis hoort
-- bij niemand, en die moeten gewoon kunnen blijven bestaan zonder opdrachtgever.

-- Nodig voor de samengestelde verwijzing hieronder. Een gewone foreign key naar
-- `care_organizations (id)` zou toestaan dat een locatie van vervoerder A naar
-- een opdrachtgever van vervoerder B wijst. Dat is precies het gat dat migratie
-- 0029 op de koppeltabellen dichtte, en het hoort hier niet opnieuw open te
-- staan.
create unique index care_organizations_org_id_unique
  on care_organizations (organization_id, id);

alter table locations
  add column care_organization_id uuid,
  add constraint locations_care_org_same_tenant
    foreign key (organization_id, care_organization_id)
    references care_organizations (organization_id, id)
    on delete set null;

comment on column locations.care_organization_id is
  'De opdrachtgever waar deze locatie een vestiging van is. Leeg voor een woonadres, station of ziekenhuis.';

-- Rapportages filteren hierop, en de locatielijst groepeert erop.
create index locations_care_org_idx
  on locations (care_organization_id)
  where care_organization_id is not null and deleted_at is null;

-- `on delete set null` en niet `cascade`: een opdrachtgever die vertrekt mag
-- nooit de adressen meenemen waar nog ritten naartoe rijden.
