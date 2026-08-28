import { type Membership } from './session';
import { type Permission } from './permissions';

/**
 * Hides UI the user may not use.
 *
 * Cosmetic only. A hidden button stops nobody who calls the Server Action
 * directly — the service layer and RLS do that (docs/ROLES_AND_PERMISSIONS.md §7).
 * Never use this as the only guard on a mutation.
 */
export function PermissionGate({
  membership,
  permission,
  children,
  fallback = null,
}: {
  membership: Membership | null;
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (!membership?.permissions.has(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
