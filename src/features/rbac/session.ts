import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { AuthenticationError, AuthorizationError } from '@/lib/errors/app-error';
import { type Permission } from './permissions';

/**
 * Session and membership resolution.
 *
 * Everything here is wrapped in React's `cache()`, so a page that checks three
 * permissions and renders the org switcher still makes one round trip per
 * request rather than five (masterprompt §49, "geen N+1 queries").
 */

export interface Membership {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly organizationSlug: string;
  readonly roleKeys: readonly string[];
  readonly permissions: ReadonlySet<Permission>;
}

export interface CurrentUser {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly memberships: readonly Membership[];
  readonly isPlatformAdmin: boolean;
}

/**
 * The signed-in user, or null.
 *
 * Uses getUser(), which revalidates the token with Supabase. getSession() only
 * reads a cookie the client can forge, so it must never gate anything.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileResult, membershipResult, platformResult] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
    supabase
      .from('organization_users')
      .select(
        `organization_id,
         organizations!inner (name, slug),
         organization_user_roles (
           roles!inner (key, role_permissions (permission_key))
         )`,
      )
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE'),
    supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const memberships: Membership[] = (membershipResult.data ?? []).map((row) => {
    const org = row.organizations;
    const roleRows = (row.organization_user_roles ?? []) as unknown as {
      roles: { key: string; role_permissions: { permission_key: string }[] };
    }[];

    const permissions = new Set<Permission>();
    const roleKeys: string[] = [];
    for (const roleRow of roleRows) {
      roleKeys.push(roleRow.roles.key);
      for (const rp of roleRow.roles.role_permissions ?? []) {
        permissions.add(rp.permission_key as Permission);
      }
    }

    return {
      organizationId: row.organization_id,
      organizationName: org.name,
      organizationSlug: org.slug,
      roleKeys,
      permissions,
    };
  });

  return {
    id: user.id,
    email: profileResult.data?.email ?? user.email ?? '',
    fullName: profileResult.data?.full_name ?? null,
    memberships,
    isPlatformAdmin: platformResult.data !== null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError('Je bent niet ingelogd.');
  return user;
}

export async function getMembership(organizationId: string): Promise<Membership | null> {
  const user = await getCurrentUser();
  return user?.memberships.find((m) => m.organizationId === organizationId) ?? null;
}

export async function hasPermission(
  organizationId: string,
  permission: Permission,
): Promise<boolean> {
  const membership = await getMembership(organizationId);
  return membership?.permissions.has(permission) ?? false;
}

/**
 * Throws unless the user holds the permission in this organisation.
 *
 * This is defence in depth, not the security boundary — RLS is (docs/SECURITY.md
 * §4). Its job is to fail early with a clear message and to make the intent of
 * a mutation greppable, so that a missing check is visible in review.
 */
export async function requirePermission(
  organizationId: string,
  permission: Permission,
): Promise<CurrentUser> {
  const user = await requireUser();
  const membership = user.memberships.find((m) => m.organizationId === organizationId);

  if (!membership?.permissions.has(permission)) {
    // Same message whether the organisation is unknown or merely forbidden, so
    // the response is not an oracle for which organisations exist (threat T12).
    throw new AuthorizationError('Geen toegang.', { permission });
  }
  return user;
}
