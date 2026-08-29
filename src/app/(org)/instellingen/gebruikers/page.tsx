import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { InviteMemberForm } from '@/features/members/components/invite-member-form';
import { MemberList } from '@/features/members/components/member-list';
import { listAssignableRoles, listMembers } from '@/features/members/service';

export const metadata: Metadata = { title: 'Gebruikers' };

export default async function MembersPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect('/dashboard');

  // The page is only reachable with this permission; the service checks it
  // again, and RLS refuses the rows regardless.
  if (!membership.permissions.has('organization.members.view')) {
    redirect('/dashboard');
  }

  const canManageRoles = membership.permissions.has('organization.roles.manage');
  const canManageMembers = membership.permissions.has('organization.members.manage');
  // Uitnodigen is beide: een lidmaatschap aanmaken én er een rol aan hangen.
  const canInvite = canManageRoles && canManageMembers;
  const [members, roles] = await Promise.all([
    listMembers(membership.organizationId),
    canManageRoles ? listAssignableRoles(membership.organizationId) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Gebruikers</h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Wie mag wat binnen {membership.organizationName}.
        </p>
      </div>

      {canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle>Iemand uitnodigen</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteMemberForm roles={roles} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Medewerkers</CardTitle>
        </CardHeader>
        <CardContent>
          <MemberList
            members={members}
            roles={roles}
            canManageRoles={canManageRoles}
            canManageMembers={canManageMembers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
