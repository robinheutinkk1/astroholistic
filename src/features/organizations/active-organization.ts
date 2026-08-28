import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getCurrentUser, type Membership } from '@/features/rbac/session';

/**
 * Which organisation the user is currently working in.
 *
 * A user can belong to several (masterprompt §7): a planner at one transport
 * company and an admin at another. The choice lives in a cookie, but the cookie
 * is never trusted on its own — it is only honoured when it names an
 * organisation the user is actually an active member of, so tampering with it
 * selects nothing.
 */
const COOKIE_NAME = 'tp_active_org';

export const getActiveMembership = cache(async (): Promise<Membership | null> => {
  const user = await getCurrentUser();
  if (!user || user.memberships.length === 0) return null;

  const store = await cookies();
  const requested = store.get(COOKIE_NAME)?.value;

  const chosen = requested
    ? user.memberships.find((m) => m.organizationId === requested)
    : undefined;

  // Falls back to the first membership rather than erroring: a stale cookie
  // after being removed from an organisation is normal, not an attack.
  return chosen ?? user.memberships[0] ?? null;
});

export async function setActiveOrganization(organizationId: string): Promise<boolean> {
  const user = await getCurrentUser();
  const isMember = user?.memberships.some((m) => m.organizationId === organizationId);
  if (!isMember) return false;

  const store = await cookies();
  store.set(COOKIE_NAME, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}
