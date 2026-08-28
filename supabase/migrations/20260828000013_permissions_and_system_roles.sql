-- ---------------------------------------------------------------------------
-- 0013 — The permission catalogue and the system roles.
--
-- This is reference data, not seed data: the application depends on these keys
-- existing, so they belong in a migration rather than in supabase/seed.
--
-- Permission keys are stable and never renamed — only added or deprecated.
-- Renaming one would silently remove access from everyone holding it.
-- ---------------------------------------------------------------------------

insert into permissions (key, category, description) values
  ('organization.view',              'organization', 'Organisatiegegevens inzien'),
  ('organization.manage',            'organization', 'Organisatiegegevens en instellingen wijzigen'),
  ('organization.members.view',      'organization', 'Ledenlijst inzien'),
  ('organization.members.manage',    'organization', 'Leden uitnodigen, schorsen, verwijderen'),
  ('organization.roles.view',        'organization', 'Rollen en permissies inzien'),
  ('organization.roles.manage',      'organization', 'Rollen aanmaken, wijzigen en toewijzen'),
  ('branding.manage',                'organization', 'Logo, kleuren en supportgegevens beheren'),
  ('domain.manage',                  'organization', 'Custom domeinen beheren'),
  ('audit.view',                     'organization', 'Auditlog inzien'),

  ('clients.view',                   'clients',      'Cliënten inzien'),
  ('clients.create',                 'clients',      'Cliënten aanmaken'),
  ('clients.update',                 'clients',      'Cliënten wijzigen'),
  ('clients.delete',                 'clients',      'Cliënten verwijderen'),
  ('contacts.view',                  'clients',      'Contactpersonen inzien'),
  ('contacts.manage',                'clients',      'Contactpersonen en koppelingen beheren'),
  ('care_organizations.view',        'clients',      'Opdrachtgevers inzien'),
  ('care_organizations.manage',      'clients',      'Opdrachtgevers beheren'),
  ('locations.view',                 'clients',      'Locaties inzien'),
  ('locations.manage',               'clients',      'Locaties beheren'),

  ('drivers.view',                   'fleet',        'Chauffeurs inzien'),
  ('drivers.manage',                 'fleet',        'Chauffeurs beheren'),
  ('vehicles.view',                  'fleet',        'Voertuigen inzien'),
  ('vehicles.manage',                'fleet',        'Voertuigen beheren'),

  ('rides.view',                     'rides',        'Alle ritten van de organisatie inzien'),
  ('rides.view.assigned',            'rides',        'Alleen eigen toegewezen ritten inzien'),
  ('rides.create',                   'rides',        'Ritten aanmaken'),
  ('rides.update',                   'rides',        'Ritten wijzigen'),
  ('rides.cancel',                   'rides',        'Ritten annuleren'),
  ('rides.assign_driver',            'rides',        'Chauffeur toewijzen'),
  ('rides.assign_vehicle',           'rides',        'Voertuig toewijzen'),
  ('rides.dispatch',                 'rides',        'Dispatchen en statusinterventies'),
  ('rides.checkin',                  'rides',        'Cliënt inchecken'),
  ('rides.checkout',                 'rides',        'Cliënt uitchecken'),
  ('rides.report_absence',           'rides',        'Afwezigheid registreren'),
  ('rides.report_problem',           'rides',        'Probleem melden'),
  ('rides.force_status',             'rides',        'Status buiten de state machine zetten'),
  ('ride_templates.view',            'rides',        'Terugkerende ritten inzien'),
  ('ride_templates.manage',          'rides',        'Terugkerende ritten beheren'),
  ('planning.view',                  'rides',        'Planning inzien'),
  ('planning.manage',                'rides',        'Planning beheren'),

  ('tags.view',                      'tags',         'NFC/QR-tags inzien'),
  ('tags.manage',                    'tags',         'NFC/QR-tags beheren'),

  ('reports.view',                   'reports',      'Rapportages inzien'),
  ('change_requests.view',           'portals',      'Wijzigingsverzoeken inzien'),
  ('change_requests.review',         'portals',      'Wijzigingsverzoeken beoordelen'),
  ('notifications.view',             'general',      'Notificaties inzien'),

  ('platform.organizations.view',    'platform',     'Organisaties op platformniveau inzien'),
  ('platform.organizations.manage',  'platform',     'Organisaties op platformniveau beheren'),
  ('platform.settings.manage',       'platform',     'Platforminstellingen beheren'),
  ('platform.logs.view',             'platform',     'Systeemlogs inzien'),
  ('platform.support.request',       'platform',     'Support-toegang aanvragen (verleent zelf geen inzage)')
;

insert into roles (id, organization_id, key, name, description, is_system) values
  (gen_random_uuid(), null, 'owner',      'Eigenaar',    'Volledige zeggenschap over de organisatie', true),
  (gen_random_uuid(), null, 'admin',      'Beheerder',   'Bijna volledige toegang binnen de organisatie', true),
  (gen_random_uuid(), null, 'planner',    'Planner',     'Ritten en terugkerende ritten beheren', true),
  (gen_random_uuid(), null, 'dispatcher', 'Dispatcher',  'Live dispatch en statusinterventies', true),
  (gen_random_uuid(), null, 'driver',     'Chauffeur',   'Eigen ritten rijden en registreren', true),
  (gen_random_uuid(), null, 'readonly',   'Alleen lezen','Meekijken zonder wijzigingsrechten', true)
;

-- Role → permission mapping, matching the table in
-- docs/ROLES_AND_PERMISSIONS.md §5. Written as explicit key lists rather than
-- wildcards so that adding a permission never silently widens a role.
with mapping (role_key, permission_key) as (
  select 'owner', key from permissions where category <> 'platform'
  union all
  select 'admin', key from permissions
    where category <> 'platform'
      and key not in ('organization.roles.manage', 'domain.manage', 'rides.view.assigned')
  union all
  select 'planner', unnest(array[
    'organization.view',
    'clients.view','clients.create','clients.update',
    'contacts.view','contacts.manage',
    'care_organizations.view','care_organizations.manage',
    'locations.view','locations.manage',
    'drivers.view','vehicles.view',
    'rides.view','rides.create','rides.update','rides.cancel',
    'rides.assign_driver','rides.assign_vehicle','rides.report_problem',
    'ride_templates.view','ride_templates.manage',
    'planning.view','planning.manage',
    'tags.view','tags.manage',
    'reports.view','change_requests.view','change_requests.review',
    'notifications.view'
  ])
  union all
  select 'dispatcher', unnest(array[
    'organization.view',
    'clients.view','contacts.view','care_organizations.view','locations.view',
    'drivers.view','vehicles.view',
    'rides.view','rides.create','rides.update','rides.cancel',
    'rides.assign_driver','rides.assign_vehicle','rides.dispatch',
    'rides.checkin','rides.checkout','rides.report_absence','rides.report_problem',
    'rides.force_status',
    'planning.view','planning.manage',
    'tags.view',
    'reports.view','change_requests.view','change_requests.review',
    'notifications.view'
  ])
  union all
  -- A driver deliberately has NO clients.view. They reach a client only through
  -- an assigned ride, inside the visibility window (masterprompt §4, D-11).
  select 'driver', unnest(array[
    'rides.view.assigned',
    'rides.checkin','rides.checkout',
    'rides.report_absence','rides.report_problem',
    'notifications.view'
  ])
  union all
  select 'readonly', unnest(array[
    'organization.view',
    'clients.view','locations.view','drivers.view','vehicles.view',
    'rides.view','planning.view','reports.view','change_requests.view',
    'notifications.view'
  ])
)
insert into role_permissions (role_id, permission_key)
select r.id, m.permission_key
from mapping m
join roles r on r.key = m.role_key and r.is_system
on conflict do nothing;
