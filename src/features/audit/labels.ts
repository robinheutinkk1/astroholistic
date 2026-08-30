import { type AuditAction } from './service';

/**
 * Elke logregel in de woorden van degene die hem leest.
 *
 * `Record<AuditAction, string>` is hier de test: wie een nieuwe actie aan het
 * type toevoegt zonder label, krijgt een compileerfout in plaats van een
 * Engels codewoord in het logboek van een klant.
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'client.created': 'Cliënt aangemaakt',
  'client.updated': 'Cliënt gewijzigd',
  'client.deleted': 'Cliënt verwijderd',
  'client.exported': 'Cliëntgegevens geëxporteerd',
  'client.anonymized': 'Cliënt geanonimiseerd',
  'contact.created': 'Contactpersoon aangemaakt',
  'contact.updated': 'Contactpersoon gewijzigd',
  'contact.linked': 'Contactpersoon gekoppeld aan cliënt',
  'contact.unlinked': 'Contactpersoon losgekoppeld van cliënt',
  'care_organization.created': 'Opdrachtgever aangemaakt',
  'care_organization.updated': 'Opdrachtgever gewijzigd',
  'care_organization.client_linked': 'Cliënt gekoppeld aan opdrachtgever',
  'care_organization.client_unlinked': 'Cliënt losgekoppeld van opdrachtgever',
  'driver.created': 'Chauffeur aangemaakt',
  'driver.updated': 'Chauffeur gewijzigd',
  'driver.deleted': 'Chauffeur verwijderd',
  'vehicle.created': 'Voertuig aangemaakt',
  'vehicle.updated': 'Voertuig gewijzigd',
  'vehicle.deleted': 'Voertuig verwijderd',
  'location.created': 'Locatie aangemaakt',
  'location.updated': 'Locatie gewijzigd',
  'location.deleted': 'Locatie verwijderd',
  'ride.created': 'Rit aangemaakt',
  'ride.updated': 'Rit gewijzigd',
  'ride.cancelled': 'Rit geannuleerd',
  'ride.assigned': 'Rit toegewezen',
  'ride.status_changed': 'Ritstatus gewijzigd',
  'ride.force_status': 'Ritstatus handmatig gecorrigeerd',
  'ride_template.created': 'Terugkerende rit aangemaakt',
  'ride_template.updated': 'Terugkerende rit gewijzigd',
  'ride_template.archived': 'Terugkerende rit gearchiveerd',
  'rides.generated': 'Ritten gegenereerd',
  'tag.created': 'Tag aangemaakt',
  'tag.assigned': 'Tag gekoppeld',
  'tag.unassigned': 'Tag losgekoppeld',
  'tag.status_changed': 'Tagstatus gewijzigd',
  'tag.lost': 'Tag als verloren gemeld',
  'tag.checked_in': 'Check-in via tag',
  'change_request.submitted': 'Verzoek ingediend',
  'change_request.reviewed': 'Verzoek beoordeeld',
  'member.invited': 'Gebruiker uitgenodigd',
  'member.roles_changed': 'Rollen gewijzigd',
  'member.suspended': 'Gebruiker geschorst',
  'member.reactivated': 'Gebruiker geactiveerd',
  'portal_access.granted': 'Portaaltoegang gegeven',
  'portal_access.revoked': 'Portaaltoegang ingetrokken',
  'branding.updated': 'Huisstijl gewijzigd',
  'branding.logo_replaced': 'Logo vervangen',
  'branding.logo_removed': 'Logo verwijderd',
  'domain.added': 'Domein toegevoegd',
  'domain.verified': 'Domein geverifieerd',
  'domain.verification_failed': 'Domeinverificatie mislukt',
  'domain.removed': 'Domein verwijderd',
  'domain.primary_changed': 'Hoofddomein gewijzigd',
  'report.exported': 'Rapport geëxporteerd',
  'support.granted': 'Supporttoegang verleend',
  'support.revoked': 'Supporttoegang ingetrokken',
  'retention.applied': 'Bewaartermijn toegepast',
};

/**
 * Een logboek bevat ook regels van vóór de laatste release: acties die de
 * code nu niet meer kent. Die krijgen hun ruwe naam, nooit een lege cel.
 */
export function auditActionLabel(action: string): string {
  return (AUDIT_ACTION_LABELS as Record<string, string>)[action] ?? action;
}
