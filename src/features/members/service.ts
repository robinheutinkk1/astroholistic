import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requirePermission, requireUser } from '@/features/rbac/session';
import { type Permission } from '@/features/rbac/permissions';
import { AuthorizationError, ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { type SetMemberStatusInput, type UpdateMemberRolesInput } from './schema';

export interface MemberRow {
  readonly membershipId: string;
  readonly userId: string;
  readonly fullName: string | null;
  readonly email: string;
  readonly status: string;
  readonly roleIds: readonly string[];
  readonly roleKeys: readonly string[];
  readonly isSelf: boolean;
}

export interface AssignableRole {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
}

export async function listMembers(organizationId: string): Promise<MemberRow[]> {
  const user = await requirePermission(organizationId, 'organization.members.view');
  const supabase = await createClient();

  const { data } = await supabase
    .from('organization_users')
    .select(
      `id, user_id, status,
       profiles!inner (full_name, email),
       organization_user_roles ( role_id, roles!inner (key) )`,
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  return (data ?? []).map((row) => {
    const profile = row.profiles as unknown as {
      full_name: string | null;
      email: string | null;
    };
    const roleRows = (row.organization_user_roles ?? []) as unknown as {
      role_id: string;
      roles: { key: string };
    }[];

    return {
      membershipId: row.id,
      userId: row.user_id,
      fullName: profile.full_name,
      email: profile.email ?? '',
      status: row.status,
      roleIds: roleRows.map((r) => r.role_id),
      roleKeys: roleRows.map((r) => r.roles.key),
      isSelf: row.user_id === user.id,
    };
  });
}

/**
 * Roles the caller is allowed to hand out.
 *
 * You cannot grant a permission you do not hold yourself
 * (docs/ROLES_AND_PERMISSIONS.md §8.1). Without this, any member who could
 * manage roles could quietly promote themselves via a colleague.
 */
export async function listAssignableRoles(
  organizationId: string,
): Promise<AssignableRole[]> {
  const user = await requirePermission(organizationId, 'organization.roles.view');
  const membership = user.memberships.find((m) => m.organizationId === organizationId);
  const supabase = await createClient();

  const { data } = await supabase
    .from('roles')
    .select(
      'id, key, name, description, is_system, organization_id, role_permissions (permission_key)',
    )
    .or(`is_system.eq.true,organization_id.eq.${organizationId}`)
    .order('name');

  return (data ?? [])
    .filter((role) => {
      const permissions = (role.role_permissions ?? []) as unknown as {
        permission_key: string;
      }[];
      return permissions.every((p) =>
        membership?.permissions.has(p.permission_key as Permission),
      );
    })
    .map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
    }));
}

export async function updateMemberRoles(
  organizationId: string,
  input: UpdateMemberRolesInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'organization.roles.manage');
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from('organization_users')
    .select('id, user_id, organization_id')
    .eq('id', input.membershipId)
    .maybeSingle();

  if (!membership || membership.organization_id !== organizationId) {
    return err(new NotFoundError('Dit lid bestaat niet.'));
  }

  // Changing your own roles is refused here and in RLS. Doing it in one step
  // would let an admin quietly widen their own access.
  if (membership.user_id === user.id) {
    return err(new AuthorizationError('Je kunt je eigen rollen niet wijzigen.'));
  }

  const assignable = await listAssignableRoles(organizationId);
  const allowedIds = new Set(assignable.map((role) => role.id));
  if (!input.roleIds.every((id) => allowedIds.has(id))) {
    return err(
      new AuthorizationError(
        'Je kunt geen rol toekennen met meer rechten dan je zelf hebt.',
      ),
    );
  }

  const { error: deleteError } = await supabase
    .from('organization_user_roles')
    .delete()
    .eq('organization_user_id', input.membershipId);
  if (deleteError)
    return err(new ConflictError('De rollen konden niet worden bijgewerkt.'));

  const { error: insertError } = await supabase.from('organization_user_roles').insert(
    input.roleIds.map((roleId) => ({
      organization_user_id: input.membershipId,
      role_id: roleId,
      granted_by: user.id,
    })),
  );

  if (insertError) {
    // The database also refuses to leave an organisation without an owner, and
    // refuses a role belonging to another tenant. Surface that, don't mask it.
    return err(
      new ConflictError(
        'De rollen konden niet worden opgeslagen. Een organisatie moet minimaal één eigenaar houden.',
      ),
    );
  }

  await supabase.from('audit_logs').insert({
    organization_id: organizationId,
    actor_user_id: user.id,
    actor_kind: 'PLANNER',
    action: 'member.roles_changed',
    entity_type: 'organization_users',
    entity_id: input.membershipId,
    metadata: { role_count: input.roleIds.length },
  });

  return ok(null);
}

export async function setMemberStatus(
  organizationId: string,
  input: SetMemberStatusInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'organization.members.manage');
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from('organization_users')
    .select('id, user_id, organization_id')
    .eq('id', input.membershipId)
    .maybeSingle();

  if (!membership || membership.organization_id !== organizationId) {
    return err(new NotFoundError('Dit lid bestaat niet.'));
  }

  // Suspending yourself would lock you out with no way back in.
  if (membership.user_id === user.id) {
    return err(new AuthorizationError('Je kunt jezelf niet schorsen.'));
  }

  const { error } = await supabase
    .from('organization_users')
    .update({ status: input.status })
    .eq('id', input.membershipId);

  if (error) return err(new ConflictError('De status kon niet worden gewijzigd.'));

  await supabase.from('audit_logs').insert({
    organization_id: organizationId,
    actor_user_id: user.id,
    actor_kind: 'PLANNER',
    action: input.status === 'SUSPENDED' ? 'member.suspended' : 'member.reactivated',
    entity_type: 'organization_users',
    entity_id: input.membershipId,
    metadata: {},
  });

  return ok(null);
}

export async function requireMembersAccess(organizationId: string): Promise<void> {
  await requireUser();
  await requirePermission(organizationId, 'organization.members.view');
}
