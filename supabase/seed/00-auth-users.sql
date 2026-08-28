-- ---------------------------------------------------------------------------
-- Demo accounts (development only).
--
-- Writes directly into auth.users so the accounts exist with a working
-- password. Without this the demo data has profiles that nobody can sign in as,
-- which makes the whole seed useless for trying the application.
--
-- ⚠ DEVELOPMENT ONLY. Every account below shares one publicly documented
-- password. Never run this against a project that holds real data.
--
-- Password for all demo accounts: tagpoint-demo-2026
-- The hash is a bcrypt digest of exactly that string.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id::uuid,
  'authenticated',
  'authenticated',
  u.email,
  '$2a$06$Ls0fSRq7xBT2Z0Z7s.nipunWrQy4AIbKGePTOyMl9rVQDtN2P91sK',
  -- Pre-confirmed: there is no inbox to click a verification link in.
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name),
  now(),
  now()
from (values
  ('a0000000-0000-4000-8000-000000000001', 'admin@ontzorgd.test',          'Anna Admin'),
  ('a0000000-0000-4000-8000-000000000002', 'planner@ontzorgd.test',        'Peter Planner'),
  ('a0000000-0000-4000-8000-000000000003', 'dispatcher@ontzorgd.test',     'Dana Dispatch'),
  ('a0000000-0000-4000-8000-000000000004', 'chauffeur1@ontzorgd.test',     'Kees Chauffeur'),
  ('a0000000-0000-4000-8000-000000000005', 'chauffeur2@ontzorgd.test',     'Sanne Chauffeur'),
  ('a0000000-0000-4000-8000-000000000006', 'ouder@ontzorgd.test',          'Olga Ouder'),
  ('a0000000-0000-4000-8000-000000000007', 'zorginstelling@ontzorgd.test', 'Zoë Zorg'),
  ('a0000000-0000-4000-8000-000000000008', 'client@ontzorgd.test',         'Jan Jansen'),
  ('b0000000-0000-4000-8000-000000000001', 'admin@voorbeeldtaxi.test',     'Bram Beheer'),
  ('b0000000-0000-4000-8000-000000000004', 'chauffeur@voorbeeldtaxi.test', 'Bas Bestuurder'),
  ('c0000000-0000-4000-8000-000000000001', 'platform@tagpoint.test',       'Pia Platform'),
  ('d0000000-0000-4000-8000-000000000001', 'buitenstaander@example.test',  'Otto Outsider')
) as u (id, email, full_name)
on conflict (id) do nothing;
