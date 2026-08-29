import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { EmptyState } from '@/components/ui/states';
import { Badge } from '@/components/ui/badge';
import { ContactForm } from '@/features/contacts/components/contact-form';
import { PortalAccessCard } from '@/features/portals/components/portal-access-card';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getContact, listClientsForContact } from '@/features/contacts/service';
import { deleteContactAction } from '@/features/contacts/actions';
import { getPortalAccountEmail } from '@/features/portals/grants';

export const metadata: Metadata = { title: 'Contactpersoon' };

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const membership = await getActiveMembership();
  if (!membership?.permissions.has('contacts.view')) redirect('/dashboard');

  const { contactId } = await params;
  const contact = await getContact(membership.organizationId, contactId);

  // Niet gevonden en geen toegang zien er hetzelfde uit, met opzet: anders
  // verraadt het antwoord dat deze persoon bij een andere vervoerder bestaat.
  if (!contact) notFound();

  const canManage = membership.permissions.has('contacts.manage');
  const [links, portalEmail] = await Promise.all([
    listClientsForContact(membership.organizationId, contactId),
    contact.user_id ? getPortalAccountEmail(contact.user_id) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {contact.first_name} {contact.last_name}
          </h1>
          <p className="text-sm text-[var(--tp-muted-foreground)]">
            {links.length === 0
              ? 'Nog niet aan een cliënt gekoppeld'
              : `Gekoppeld aan ${links.length} ${links.length === 1 ? 'cliënt' : 'cliënten'}`}
          </p>
        </div>

        {canManage ? (
          <DeleteDialog
            id={contact.id}
            title="Contactpersoon verwijderen?"
            description="De koppelingen met cliënten verdwijnen en eventuele portaaltoegang stopt per direct. De ritgeschiedenis blijft ongewijzigd."
            action={deleteContactAction}
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <ContactForm contact={contact} />
          ) : (
            <dl className="grid max-w-lg gap-3 text-sm sm:grid-cols-2">
              <dt className="text-[var(--tp-muted-foreground)]">Telefoon</dt>
              <dd>{contact.phone ?? '-'}</dd>
              <dt className="text-[var(--tp-muted-foreground)]">E-mailadres</dt>
              <dd>{contact.email ?? '-'}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gekoppelde cliënten</CardTitle>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <EmptyState
              title="Nog geen cliënten"
              description="Ga naar een cliënt en koppel deze contactpersoon daar."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {links.map((link) => (
                <li
                  key={link.clientId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--tp-radius)] border border-[var(--tp-border)] p-3"
                >
                  <div>
                    <Link
                      href={`/clienten/${link.clientId}` as never}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {link.firstName} {link.lastName}
                    </Link>
                    <p className="text-xs text-[var(--tp-muted-foreground)]">
                      {link.relationship ?? 'Geen relatie ingevuld'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {link.isPrimary ? <Badge variant="info">Eerste contact</Badge> : null}
                    {link.canViewRides ? (
                      <Badge variant="neutral">Ziet ritten</Badge>
                    ) : null}
                    {link.canReportAbsence ? (
                      <Badge variant="neutral">Meldt afwezig</Badge>
                    ) : null}
                    {link.canRequestChanges ? (
                      <Badge variant="neutral">Vraagt wijzigingen aan</Badge>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portaaltoegang</CardTitle>
        </CardHeader>
        <CardContent>
          <PortalAccessCard
            kind="CONTACT"
            subjectId={contact.id}
            currentEmail={portalEmail}
            canManage={canManage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
