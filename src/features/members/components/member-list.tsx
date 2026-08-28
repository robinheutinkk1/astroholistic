'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { IDLE, type FormState } from '@/features/auth/actions';
import { ROLE_LABELS, type SystemRoleKey } from '@/features/rbac/permissions';
import { FormStatus } from '@/features/auth/components/form-status';
import { setMemberStatusAction, updateMemberRolesAction } from '../actions';
import type { AssignableRole, MemberRow } from '../service';

function StatusButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

function RolesButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      Opslaan
    </Button>
  );
}

export function MemberList({
  members,
  roles,
  canManageRoles,
  canManageMembers,
}: {
  members: readonly MemberRow[];
  roles: readonly AssignableRole[];
  canManageRoles: boolean;
  canManageMembers: boolean;
}) {
  const [roleState, roleAction] = useActionState<FormState, FormData>(
    updateMemberRolesAction,
    IDLE,
  );
  const [statusState, statusAction] = useActionState<FormState, FormData>(
    setMemberStatusAction,
    IDLE,
  );

  if (members.length === 0) {
    return (
      <EmptyState
        title="Nog geen medewerkers"
        description="Nodig collega's uit om samen de planning te beheren."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormStatus state={roleState} />
      <FormStatus state={statusState} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="sr-only">Medewerkers van deze organisatie</caption>
          <thead>
            <tr className="border-b border-[var(--tp-border)] text-left">
              <th scope="col" className="py-2 pr-4 font-medium">
                Naam
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Rollen
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Status
              </th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Acties</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.membershipId}
                className="border-b border-[var(--tp-border)]"
              >
                <td className="py-3 pr-4">
                  <div className="font-medium">
                    {member.fullName ?? member.email}
                    {member.isSelf ? (
                      <span className="ml-1 text-xs text-[var(--tp-muted-foreground)]">
                        (jij)
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--tp-muted-foreground)]">
                    {member.email}
                  </div>
                </td>

                <td className="py-3 pr-4 align-top">
                  {canManageRoles && !member.isSelf ? (
                    <form
                      action={roleAction}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input
                        type="hidden"
                        name="membershipId"
                        value={member.membershipId}
                      />
                      <fieldset className="flex flex-wrap gap-2">
                        <legend className="sr-only">
                          Rollen voor {member.fullName ?? member.email}
                        </legend>
                        {roles.map((role) => (
                          <label
                            key={role.id}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <input
                              type="checkbox"
                              name="roleIds"
                              value={role.id}
                              defaultChecked={member.roleIds.includes(role.id)}
                            />
                            {ROLE_LABELS[role.key as SystemRoleKey] ?? role.name}
                          </label>
                        ))}
                      </fieldset>
                      <RolesButton />
                    </form>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {member.roleKeys.map((key) => (
                        <Badge key={key} variant="info">
                          {ROLE_LABELS[key as SystemRoleKey] ?? key}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>

                <td className="py-3 pr-4 align-top">
                  <Badge variant={member.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {member.status === 'ACTIVE'
                      ? 'Actief'
                      : member.status === 'INVITED'
                        ? 'Uitgenodigd'
                        : 'Geschorst'}
                  </Badge>
                </td>

                <td className="py-3 align-top">
                  {canManageMembers && !member.isSelf ? (
                    <form action={statusAction}>
                      <input
                        type="hidden"
                        name="membershipId"
                        value={member.membershipId}
                      />
                      <input
                        type="hidden"
                        name="status"
                        value={member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'}
                      />
                      <StatusButton
                        label={member.status === 'ACTIVE' ? 'Schorsen' : 'Activeren'}
                      />
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
