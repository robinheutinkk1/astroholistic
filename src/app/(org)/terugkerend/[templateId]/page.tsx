import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { TemplateForm } from '@/features/ride-templates/components/template-form';
import { loadPickerOptions } from '@/features/rides/pickers';
import { countFutureRides, getTemplate } from '@/features/ride-templates/service';
import { archiveTemplateAction } from '@/features/ride-templates/actions';
import { getActiveMembership } from '@/features/organizations/active-organization';

export const metadata: Metadata = { title: 'Terugkerende rit' };

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('ride_templates.view')) redirect('/dashboard');

  const { templateId } = await params;
  const template = await getTemplate(membership.organizationId, templateId);
  if (!template) notFound();

  const [options, futureRides] = await Promise.all([
    loadPickerOptions(membership.organizationId),
    countFutureRides(membership.organizationId, templateId),
  ]);

  const canManage = membership.permissions.has('ride_templates.manage');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {template.name ?? 'Terugkerende rit'}
        </h1>
        {canManage ? (
          <DeleteDialog
            id={template.id}
            title="Deze afspraak stoppen?"
            description={`Er worden geen nieuwe ritten meer ingepland. De ${futureRides.total} al ingeplande ritten blijven staan; die annuleer je apart als dat nodig is.`}
            action={archiveTemplateAction}
            triggerLabel="Stoppen"
            confirmLabel="Afspraak stoppen"
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>De vaste afspraak</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <TemplateForm template={template} {...options} futureRides={futureRides} />
          ) : (
            <p className="text-sm text-[var(--tp-muted-foreground)]">
              Je hebt geen rechten om deze afspraak te wijzigen.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
