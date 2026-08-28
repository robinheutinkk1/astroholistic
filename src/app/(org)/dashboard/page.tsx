import type { Metadata } from 'next';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getCurrentUser } from '@/features/rbac/session';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS, type SystemRoleKey } from '@/features/rbac/permissions';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Placeholder dashboard for Fase 3. The real counters (rides today, completed,
 * en route, problems) arrive in Fase 4 once there is ride data to read.
 */
export default async function DashboardPage() {
  const [user, membership] = await Promise.all([getCurrentUser(), getActiveMembership()]);
  if (!user || !membership) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Welkom{user.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          {membership.organizationName}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jouw toegang</CardTitle>
          <CardDescription>
            Wat je ziet in het menu hangt af van je rol. Deze kaart verdwijnt zodra de
            dagcijfers er zijn (Fase 4).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {membership.roleKeys.map((key) => (
              <Badge key={key} variant="info">
                {ROLE_LABELS[key as SystemRoleKey] ?? key}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            {membership.permissions.size} rechten binnen deze organisatie.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
