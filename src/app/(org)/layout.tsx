import { redirect } from 'next/navigation';
import { Sidebar, type NavItem } from '@/components/layout/sidebar';
import { UserMenu } from '@/components/layout/user-menu';
import { OrganizationSwitcher } from '@/features/organizations/components/organization-switcher';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getCurrentUser } from '@/features/rbac/session';
import { ROLE_LABELS, type SystemRoleKey } from '@/features/rbac/permissions';
import { createClient } from '@/lib/supabase/server';

/**
 * Shell for the organisation-facing application. Desktop-first: planners and
 * dispatchers work on a large screen (masterprompt §67.20). The driver PWA has
 * its own mobile-first shell under /driver.
 */
const ALL_NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    permission: 'organization.view',
  },
  { href: '/planning', label: 'Planning', icon: 'planning', permission: 'planning.view' },
  {
    href: '/terugkerend',
    label: 'Terugkerend',
    icon: 'planning',
    permission: 'ride_templates.view',
  },
  {
    href: '/dispatch',
    label: 'Dispatch',
    icon: 'dispatch',
    permission: 'rides.dispatch',
  },
  { href: '/clienten', label: 'Cliënten', icon: 'clients', permission: 'clients.view' },
  {
    href: '/chauffeurs',
    label: 'Chauffeurs',
    icon: 'drivers',
    permission: 'drivers.view',
  },
  {
    href: '/voertuigen',
    label: 'Voertuigen',
    icon: 'vehicles',
    permission: 'vehicles.view',
  },
  {
    href: '/locaties',
    label: 'Locaties',
    icon: 'locations',
    permission: 'locations.view',
  },
  {
    href: '/opdrachtgevers',
    label: 'Opdrachtgevers',
    icon: 'care',
    permission: 'care_organizations.view',
  },
  { href: '/tags', label: 'NFC-tags', icon: 'tags', permission: 'tags.view' },
  {
    href: '/instellingen',
    label: 'Instellingen',
    icon: 'settings',
    permission: 'organization.view',
  },
];

export default async function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const membership = await getActiveMembership();

  // A signed-in account with no membership is a real state: an invited user
  // whose invitation was withdrawn, or a portal user who reached the wrong URL.
  // It deserves an explanation rather than an empty dashboard.
  if (!membership) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Nog geen toegang</h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Je account hoort nog niet bij een organisatie. Vraag de beheerder van je
          vervoersbedrijf om je uit te nodigen.
        </p>
      </main>
    );
  }

  // Branding is loaded server-side and applied as CSS custom properties on the
  // shell, so there is no flash of platform colours before the tenant's own
  // (docs/ARCHITECTURE.md §11).
  const supabase = await createClient();
  const { data: branding } = await supabase
    .from('organization_branding')
    .select('display_name, primary_color, secondary_color')
    .eq('organization_id', membership.organizationId)
    .maybeSingle();

  const navItems = ALL_NAV_ITEMS.filter((item) =>
    membership.permissions.has(item.permission),
  );

  const roleLabels = membership.roleKeys.map(
    (key) => ROLE_LABELS[key as SystemRoleKey] ?? key,
  );

  const brandStyle = {
    ...(branding?.primary_color ? { '--tp-primary': branding.primary_color } : {}),
    ...(branding?.secondary_color ? { '--tp-secondary': branding.secondary_color } : {}),
  } as React.CSSProperties;

  return (
    <div style={brandStyle} className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 border-r border-[var(--tp-border)] bg-[var(--tp-surface-muted)] md:block">
        <div className="flex h-14 items-center border-b border-[var(--tp-border)] px-4">
          <span className="truncate text-sm font-semibold">
            {branding?.display_name ?? membership.organizationName}
          </span>
        </div>
        <Sidebar items={navItems} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-[var(--tp-border)] px-4">
          <OrganizationSwitcher
            activeId={membership.organizationId}
            options={user.memberships.map((m) => ({
              id: m.organizationId,
              name: m.organizationName,
            }))}
          />
          <UserMenu fullName={user.fullName} email={user.email} roleLabels={roleLabels} />
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
