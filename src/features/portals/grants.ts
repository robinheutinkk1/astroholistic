import 'server-only';
import { z } from 'zod';
import { requirePermission } from '@/features/rbac/session';
import { type Permission } from '@/features/rbac/permissions';
import { inviteOrFindUser } from '@/features/auth/invite';
import { recordAudit } from '@/features/audit/service';
import { createClient } from '@/lib/supabase/server';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';

/**
 * Portaaltoegang geven en weer intrekken.
 *
 * DRIE SOORTEN, ÉÉN ROUTE. Een cliënt, een contactpersoon en een medewerker
 * van een zorgorganisatie loggen alle drie in op hetzelfde portaal (zie
 * access.ts); wat ze te zien krijgen komt uit de relatie, niet uit een rol.
 * Toegang geven is daarom ook één handeling met drie aanhechtpunten, en niet
 * drie half-gelijke schermen die los uit elkaar groeien.
 *
 * Wat hier NIET gebeurt is een rol toekennen. Een portaalgebruiker is geen lid
 * van de organisatie: hij staat in geen enkele `organization_users`-rij en
 * heeft dus geen enkele permissie. Zou dat wel zo zijn, dan zou een ouder in
 * het permissiestelsel zitten waar planners in zitten, en is één verkeerd
 * vinkje genoeg om hem de hele planning te laten zien.
 */

export const PORTAL_SUBJECT_KINDS = ['CLIENT', 'CONTACT', 'CARE_ORG'] as const;
export type PortalSubjectKind = (typeof PORTAL_SUBJECT_KINDS)[number];

export const portalAccessSchema = z.object({
  kind: z.enum(PORTAL_SUBJECT_KINDS),
  subjectId: z.uuid(),
  email: z
    .string()
    .min(1, 'Vul een e-mailadres in.')
    .email('Dat lijkt geen geldig e-mailadres.')
    .transform((value) => value.trim().toLowerCase()),
});

export const portalRevokeSchema = z.object({
  kind: z.enum(PORTAL_SUBJECT_KINDS),
  subjectId: z.uuid(),
});

export type PortalAccessInput = z.infer<typeof portalAccessSchema>;
export type PortalRevokeInput = z.infer<typeof portalRevokeSchema>;

/**
 * Wie welke soort toegang mag uitdelen.
 *
 * Bewust niet één permissie voor alle drie: wie contactpersonen beheert hoeft
 * nog niet de gegevens van de cliënt zelf te mogen wijzigen.
 */
const REQUIRED_PERMISSION: Record<PortalSubjectKind, Permission> = {
  CLIENT: 'clients.update',
  CONTACT: 'contacts.manage',
  CARE_ORG: 'care_organizations.manage',
};

const SUBJECT_LABEL: Record<PortalSubjectKind, string> = {
  CLIENT: 'de cliënt',
  CONTACT: 'de contactpersoon',
  CARE_ORG: 'de zorgorganisatie',
};

/**
 * Bestaat dit onderwerp, en hoort het bij deze organisatie?
 *
 * RLS weigert de rij al als hij van een andere vervoerder is, maar dan zou het
 * verschil tussen "bestaat niet" en "mag je niet zien" pas bij de update
 * blijken — en zou er ondertussen wel een uitnodigingsmail zijn verstuurd naar
 * iemand die daar niets van begrijpt.
 */
async function findSubject(
  kind: PortalSubjectKind,
  organizationId: string,
  subjectId: string,
): Promise<{ userId: string | null } | null> {
  const supabase = await createClient();

  if (kind === 'CARE_ORG') {
    const { data } = await supabase
      .from('care_organizations')
      .select('id')
      .eq('id', subjectId)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .maybeSingle();
    // Een zorgorganisatie heeft geen `user_id`: daar kunnen meerdere
    // medewerkers aan hangen, via care_organization_users.
    return data ? { userId: null } : null;
  }

  const table = kind === 'CLIENT' ? 'clients' : 'contacts';
  const { data } = await supabase
    .from(table)
    .select('id, user_id')
    .eq('id', subjectId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle();

  return data ? { userId: data.user_id } : null;
}

export async function grantPortalAccess(
  organizationId: string,
  input: PortalAccessInput,
): Promise<Result<{ invited: boolean }>> {
  const user = await requirePermission(organizationId, REQUIRED_PERMISSION[input.kind]);

  const subject = await findSubject(input.kind, organizationId, input.subjectId);
  if (!subject) {
    return err(new NotFoundError(`${SUBJECT_LABEL[input.kind]} bestaat niet.`));
  }

  // Eerst controleren, dan pas een account maken: een geweigerde poging mag
  // nooit toch een mail opleveren.
  if (input.kind !== 'CARE_ORG' && subject.userId) {
    return err(
      new ConflictError(
        `${SUBJECT_LABEL[input.kind]} heeft al portaaltoegang. Trek die eerst in als je een ander adres wilt koppelen.`,
      ),
    );
  }

  const outcome = await inviteOrFindUser(input.email);
  if (outcome.kind === 'FAILED') {
    return err(
      new ConflictError(
        'De uitnodiging kon niet worden verstuurd. Controleer of e-mail is ingesteld op dit platform.',
      ),
    );
  }

  const supabase = await createClient();

  if (input.kind === 'CARE_ORG') {
    const { error } = await supabase.from('care_organization_users').insert({
      care_organization_id: input.subjectId,
      user_id: outcome.userId,
      status: outcome.kind === 'EXISTING' ? 'ACTIVE' : 'INVITED',
    });
    // 23505: deze medewerker was er al. Dat is geen fout, dat is twee keer
    // klikken.
    if (error && error.code !== '23505') {
      return err(new ConflictError('De toegang kon niet worden vastgelegd.'));
    }
  } else {
    const { data, error } = await supabase
      .from(input.kind === 'CLIENT' ? 'clients' : 'contacts')
      .update({ user_id: outcome.userId })
      .eq('id', input.subjectId)
      .eq('organization_id', organizationId)
      // De koppeling wordt alleen gelegd als er nog geen account aan hing.
      // Tussen de controle hierboven en dit moment kan een collega hetzelfde
      // hebben gedaan; dan hoort de tweede poging te verliezen, niet te
      // overschrijven.
      .is('user_id', null)
      .select('id');

    if (error || (data ?? []).length === 0) {
      return err(
        new ConflictError('De toegang kon niet worden vastgelegd. Ververs de pagina.'),
      );
    }
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'portal_access.granted',
    entityType: input.kind === 'CARE_ORG' ? 'care_organizations' : `${input.kind.toLowerCase()}s`,
    entityId: input.subjectId,
    // Geen e-mailadres in het logboek: dat is een persoonsgegeven dat hier
    // niets toevoegt. Wie het was staat in de gekoppelde rij.
    metadata: { kind: input.kind, existing_account: outcome.kind === 'EXISTING' },
  });

  return ok({ invited: outcome.kind === 'INVITED' });
}

/**
 * Toegang intrekken.
 *
 * Het account blijft bestaan — die persoon kan bij een andere vervoerder ook
 * een portaal hebben. Alleen de koppeling gaat weg, en daarmee ziet hij per
 * direct niets meer van deze organisatie: RLS leest de koppeling bij elke
 * query opnieuw, dus er is geen sessie die nog even doorloopt.
 */
export async function revokePortalAccess(
  organizationId: string,
  input: PortalRevokeInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, REQUIRED_PERMISSION[input.kind]);

  const supabase = await createClient();

  if (input.kind === 'CARE_ORG') {
    return err(
      new ConflictError(
        'Toegang van een zorgorganisatie trek je per medewerker in, niet in één keer.',
      ),
    );
  }

  const { data, error } = await supabase
    .from(input.kind === 'CLIENT' ? 'clients' : 'contacts')
    .update({ user_id: null })
    .eq('id', input.subjectId)
    .eq('organization_id', organizationId)
    .select('id');

  if (error || (data ?? []).length === 0) {
    return err(new NotFoundError(`${SUBJECT_LABEL[input.kind]} bestaat niet.`));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'portal_access.revoked',
    entityType: `${input.kind.toLowerCase()}s`,
    entityId: input.subjectId,
    metadata: { kind: input.kind },
  });

  return ok(null);
}

export interface CareOrgPortalUser {
  readonly id: string;
  readonly userId: string;
  readonly fullName: string | null;
  readonly email: string;
  readonly status: string;
}

/** De medewerkers van een zorgorganisatie die op het portaal kunnen. */
export async function listCareOrgPortalUsers(
  organizationId: string,
  careOrganizationId: string,
): Promise<CareOrgPortalUser[]> {
  await requirePermission(organizationId, 'care_organizations.view');
  const supabase = await createClient();

  const { data } = await supabase
    .from('care_organization_users')
    .select('id, user_id, status, profile:profiles!care_organization_users_user_id_fkey (full_name, email)')
    .eq('care_organization_id', careOrganizationId);

  return (data ?? []).map((row) => {
    const profile = row.profile as unknown as {
      full_name: string | null;
      email: string;
    } | null;
    return {
      id: row.id,
      userId: row.user_id,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? '—',
      status: row.status,
    };
  });
}

/** Trekt de toegang van één medewerker van een zorgorganisatie in. */
export async function revokeCareOrgPortalUser(
  organizationId: string,
  careOrganizationId: string,
  membershipId: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'care_organizations.manage');
  const supabase = await createClient();

  // De zorgorganisatie moet van deze vervoerder zijn. RLS dwingt dat af op de
  // delete zelf; deze controle zorgt dat een verkeerd id een nette melding
  // oplevert in plaats van "er is niets verwijderd".
  const { data: careOrg } = await supabase
    .from('care_organizations')
    .select('id')
    .eq('id', careOrganizationId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!careOrg) return err(new NotFoundError('Deze zorgorganisatie bestaat niet.'));

  const { data } = await supabase
    .from('care_organization_users')
    .delete()
    .eq('id', membershipId)
    .eq('care_organization_id', careOrganizationId)
    .select('id');

  if ((data ?? []).length === 0) {
    return err(new NotFoundError('Deze toegang bestaat niet meer.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'portal_access.revoked',
    entityType: 'care_organizations',
    entityId: careOrganizationId,
    metadata: { kind: 'CARE_ORG' },
  });

  return ok(null);
}

/**
 * Het adres dat aan een portaalaccount hangt.
 *
 * Gaat bewust via de sessie van de gebruiker en niet via de service role: of
 * je dit profiel mag zien is een vraag voor RLS (migratie 0028), en die vraag
 * mag de applicatie niet zelf beantwoorden. Levert null op als het profiel
 * niet zichtbaar is, en dat is dan het juiste antwoord.
 */
export async function getPortalAccountEmail(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();
  return data?.email ?? null;
}
