-- ---------------------------------------------------------------------------
-- 0002 — Organisations, their settings, branding, domains and subscriptions.
--
-- Every table gets `enable row level security` in the same statement block that
-- creates it. With RLS on and no policies yet, the table denies everything —
-- fail closed. Policies arrive in 0005, once the helper functions exist.
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name text not null,
  legal_name text,
  status org_status not null default 'TRIAL',
  -- Demo organisations must never be linked to real customer data (§56).
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organizations_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  constraint organizations_name_not_blank check (length(btrim(name)) > 0)
);
alter table organizations enable row level security;
create index organizations_status_idx on organizations (status) where deleted_at is null;

create table organization_settings (
  organization_id uuid primary key references organizations (id) on delete cascade,
  timezone text not null default 'Europe/Amsterdam',
  locale text not null default 'nl-NL',
  checkin_required boolean not null default true,
  checkout_mode checkout_mode not null default 'OPTIONAL',
  gps_capture_enabled boolean not null default false,
  ride_generation_horizon_days integer not null default 60,
  -- How far ahead a driver may see client details (decision D-11).
  driver_client_visibility_days integer not null default 7,
  allow_contact_absence_reporting boolean not null default true,
  absence_cutoff_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_horizon_range check (ride_generation_horizon_days between 1 and 180),
  constraint settings_visibility_range check (driver_client_visibility_days between 0 and 90),
  constraint settings_cutoff_range check (absence_cutoff_minutes between 0 and 1440),
  -- Rejects a typo'd timezone at write time rather than at 06:00 in production.
  constraint settings_timezone_valid check (app.is_valid_timezone(timezone))
);
alter table organization_settings enable row level security;

create table organization_branding (
  organization_id uuid primary key references organizations (id) on delete cascade,
  display_name text,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  support_email citext,
  support_phone text,
  hide_platform_branding boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Hex only. Free-form CSS here would be an injection vector in a white-label
  -- product (docs/SECURITY.md, threat T16).
  constraint branding_primary_hex check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint branding_secondary_hex check (secondary_color is null or secondary_color ~ '^#[0-9a-fA-F]{6}$')
);
alter table organization_branding enable row level security;

create table organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  hostname citext not null unique,
  is_primary boolean not null default false,
  verification_token text,
  verification_status domain_verification_status not null default 'PENDING',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint domains_hostname_format check (hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
);
alter table organization_domains enable row level security;
create index organization_domains_org_idx on organization_domains (organization_id);
create unique index organization_domains_one_primary
  on organization_domains (organization_id) where is_primary;

-- --- SaaS skeleton (§36). No billing logic; the shape exists so adding it
-- later does not require migrating live data. ------------------------------
create table plans (
  id uuid primary key default gen_random_uuid(),
  key citext not null unique,
  name text not null,
  limits jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table plans enable row level security;

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  plan_id uuid not null references plans (id),
  status subscription_status not null default 'TRIALING',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table subscriptions enable row level security;
create unique index subscriptions_one_active_per_org
  on subscriptions (organization_id) where status in ('TRIALING', 'ACTIVE');

create table usage_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  metric_key text not null,
  period_start date not null,
  value numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, metric_key, period_start)
);
alter table usage_metrics enable row level security;

create trigger organizations_touch before update on organizations
  for each row execute function app.touch_updated_at();
create trigger organization_settings_touch before update on organization_settings
  for each row execute function app.touch_updated_at();
create trigger organization_branding_touch before update on organization_branding
  for each row execute function app.touch_updated_at();
create trigger organization_domains_touch before update on organization_domains
  for each row execute function app.touch_updated_at();
create trigger plans_touch before update on plans
  for each row execute function app.touch_updated_at();
create trigger subscriptions_touch before update on subscriptions
  for each row execute function app.touch_updated_at();
create trigger usage_metrics_touch before update on usage_metrics
  for each row execute function app.touch_updated_at();
