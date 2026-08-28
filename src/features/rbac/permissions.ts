/**
 * The permission catalogue, mirroring supabase/migrations/…_permissions_and_system_roles.sql.
 *
 * Keeping a typed copy here is what turns `requirePermission(orgId, 'clients.viev')`
 * into a compile error instead of a silent denial at runtime. The test in
 * tests/security asserts this list matches the database exactly, so the two
 * cannot drift.
 *
 * Keys are stable and never renamed — renaming one silently removes access from
 * everyone who holds it.
 */
export const PERMISSIONS = [
  'organization.view',
  'organization.manage',
  'organization.members.view',
  'organization.members.manage',
  'organization.roles.view',
  'organization.roles.manage',
  'branding.manage',
  'domain.manage',
  'audit.view',

  'clients.view',
  'clients.create',
  'clients.update',
  'clients.delete',
  'contacts.view',
  'contacts.manage',
  'care_organizations.view',
  'care_organizations.manage',
  'locations.view',
  'locations.manage',

  'drivers.view',
  'drivers.manage',
  'vehicles.view',
  'vehicles.manage',

  'rides.view',
  'rides.view.assigned',
  'rides.create',
  'rides.update',
  'rides.cancel',
  'rides.assign_driver',
  'rides.assign_vehicle',
  'rides.dispatch',
  'rides.checkin',
  'rides.checkout',
  'rides.report_absence',
  'rides.report_problem',
  'rides.force_status',
  'ride_templates.view',
  'ride_templates.manage',
  'planning.view',
  'planning.manage',

  'tags.view',
  'tags.manage',

  'reports.view',
  'change_requests.view',
  'change_requests.review',
  'notifications.view',

  'platform.organizations.view',
  'platform.organizations.manage',
  'platform.settings.manage',
  'platform.logs.view',
  'platform.support.request',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const SYSTEM_ROLE_KEYS = [
  'owner',
  'admin',
  'planner',
  'dispatcher',
  'driver',
  'readonly',
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

/** Dutch labels for the settings screens. */
export const ROLE_LABELS: Record<SystemRoleKey, string> = {
  owner: 'Eigenaar',
  admin: 'Beheerder',
  planner: 'Planner',
  dispatcher: 'Dispatcher',
  driver: 'Chauffeur',
  readonly: 'Alleen lezen',
};

export const ROLE_DESCRIPTIONS: Record<SystemRoleKey, string> = {
  owner: 'Volledige zeggenschap, inclusief rollen en domeinen.',
  admin: 'Bijna volledige toegang binnen de organisatie.',
  planner: 'Ritten, terugkerende ritten en cliënten beheren.',
  dispatcher: 'Live dispatch, statusinterventies en toewijzingen.',
  driver: 'Eigen ritten rijden en registreren. Geen cliëntenlijst.',
  readonly: 'Meekijken zonder wijzigingsrechten.',
};

/** Groups permissions for display, matching the `category` column. */
export const PERMISSION_CATEGORY_LABELS: Record<string, string> = {
  organization: 'Organisatie',
  clients: 'Cliënten en relaties',
  fleet: 'Vloot',
  rides: 'Ritten en planning',
  tags: 'NFC en QR',
  reports: 'Rapportages',
  portals: 'Portalen',
  general: 'Algemeen',
  platform: 'Platform',
};
