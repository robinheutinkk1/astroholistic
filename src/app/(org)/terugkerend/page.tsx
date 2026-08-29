import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/data-table';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { GenerateButton } from '@/features/ride-templates/components/generate-button';
import { listTemplates } from '@/features/ride-templates/service';
import { describeRecurrence } from '@/features/ride-templates/occurrences';
import { TEMPLATE_STATUS_LABELS } from '@/features/ride-templates/schema';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Terugkerende ritten' };

async function TemplateTable({ organizationId }: { organizationId: string }) {
  const templates = await listTemplates(organizationId);

  if (templates.length === 0) {
    return (
      <EmptyState
        title="Nog geen terugkerende ritten"
        description="Leg een vaste afspraak één keer vast; het systeem plant hem daarna zelf in."
      />
    );
  }

  return (
    <Table caption="Terugkerende ritten">
      <Thead>
        <Th>Tijd</Th>
        <Th>Cliënt</Th>
        <Th>Dagen</Th>
        <Th>Van en naar</Th>
        <Th>Chauffeur</Th>
        <Th>Status</Th>
      </Thead>
      <Tbody>
        {templates.map((template) => (
          <Tr key={template.id}>
            <Td className="font-medium whitespace-nowrap tabular-nums">
              {template.departure_time.slice(0, 5)}
            </Td>
            <Td>
              <Link
                href={`/terugkerend/${template.id}` as never}
                className="font-medium underline-offset-4 hover:underline"
              >
                {template.client
                  ? `${template.client.first_name} ${template.client.last_name}`
                  : 'Onbekend'}
              </Link>
              {template.name ? (
                <span className="block text-xs text-[var(--tp-muted-foreground)]">
                  {template.name}
                </span>
              ) : null}
            </Td>
            <Td className="text-[var(--tp-muted-foreground)]">
              {describeRecurrence(template.days_of_week)}
            </Td>
            <Td className="text-[var(--tp-muted-foreground)]">
              <span className="block">{template.pickup?.name ?? '-'}</span>
              <span className="block text-xs">→ {template.destination?.name ?? '-'}</span>
            </Td>
            <Td className="text-[var(--tp-muted-foreground)]">
              {template.driver
                ? `${template.driver.first_name} ${template.driver.last_name}`
                : 'Wisselend'}
            </Td>
            <Td>
              <Badge variant={template.status === 'ACTIVE' ? 'success' : 'neutral'}>
                {TEMPLATE_STATUS_LABELS[template.status]}
              </Badge>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

export default async function TemplatesPage() {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('ride_templates.view')) redirect('/dashboard');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Terugkerende ritten</h1>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            Vaste afspraken die het systeem automatisch inplant.
          </p>
        </div>

        {membership.permissions.has('ride_templates.manage') ? (
          <div className="flex flex-wrap gap-2">
            <GenerateButton />
            <Button asChild>
              <Link href="/terugkerend/nieuw">
                <Plus aria-hidden="true" />
                Nieuwe afspraak
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      <Card>
        <CardContent className="pt-5">
          <Suspense fallback={<LoadingState />}>
            <TemplateTable organizationId={membership.organizationId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
