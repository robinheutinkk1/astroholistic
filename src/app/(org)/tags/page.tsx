import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TagManager } from '@/features/tags/components/tag-manager';
import { listTags } from '@/features/tags/service';
import { loadPickerOptions } from '@/features/rides/pickers';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'NFC-tags' };

export default async function TagsPage() {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('tags.view')) redirect('/dashboard');

  const [tags, options] = await Promise.all([
    listTags(membership.organizationId),
    loadPickerOptions(membership.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">NFC-tags</h1>
        <p className="text-sm text-[var(--tp-muted-foreground)]">
          Eén tag per cliënt. Dezelfde tag werkt als NFC en als QR-code.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Op de tag zelf staat alleen de code — nooit de naam van de cliënt. Wie hem
            vindt, kan er niets mee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagManager
            tags={tags}
            clients={options.clients}
            canManage={membership.permissions.has('tags.manage')}
            appUrl={publicEnv.NEXT_PUBLIC_APP_URL}
          />
        </CardContent>
      </Card>
    </div>
  );
}
