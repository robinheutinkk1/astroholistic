import 'server-only';
/*
 * De zevende service-role-taak (zie src/lib/supabase/admin.ts).
 *
 * Gedeeld door twee kanten van het product: een medewerker die lid wordt van
 * een organisatie, en een cliënt, contactpersoon of zorgcoördinator die
 * portaaltoegang krijgt. Allebei komen neer op hetzelfde: een account in
 * `auth.users` dat er misschien al is.
 *
 * Een account aanmaken en een uitnodigingsmail versturen gebeurt in
 * `auth.users`, en daar mag geen enkele tenant bij. Dit is de enige plek in de
 * applicatie die dat doet.
 */
// eslint-disable-next-line no-restricted-imports
import { createUnscopedAdminClient } from '@/lib/supabase/admin';
import { publicEnv } from '@/lib/env';

export type InviteOutcome =
  /** Nieuw account, mail onderweg. */
  | { readonly kind: 'INVITED'; readonly userId: string }
  /** Bestond al; alleen het lidmaatschap wordt toegevoegd, geen mail. */
  | { readonly kind: 'EXISTING'; readonly userId: string }
  | { readonly kind: 'FAILED'; readonly reason: string };

/**
 * Nodigt iemand uit, of vindt het bestaande account.
 *
 * TWEE UITKOMSTEN DIE ALLEBEI GOED ZIJN. Een e-mailadres dat al een account
 * heeft is geen fout: dat is een chauffeur die bij twee vervoerders rijdt, of
 * een planner die eerder bij deze organisatie werkte. Die krijgt geen tweede
 * uitnodiging — hij logt gewoon in met wat hij al heeft — maar wel het nieuwe
 * lidmaatschap.
 *
 * Het onderscheid komt uit `profiles`, niet uit de foutmelding van de
 * uitnodiging: sinds migratie 0027 heeft elk account een profiel, dus dat is de
 * betrouwbare bron. Op de foutmelding vertrouwen zou betekenen dat we de
 * bewoording van een externe dienst als API gebruiken.
 */
export async function inviteOrFindUser(email: string): Promise<InviteOutcome> {
  const admin = createUnscopedAdminClient(
    'gebruiker uitnodigen: maakt een account in auth.users, buiten elke tenantgrens',
  );

  const normalized = email.trim().toLowerCase();

  // Bestaat er al een account met dit adres?
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();

  if (existing) return { kind: 'EXISTING', userId: existing.id };

  const { data, error } = await admin.auth.admin.inviteUserByEmail(normalized, {
    // Na het instellen van een wachtwoord komt de gebruiker op de voordeur uit,
    // die hem doorstuurt op basis van zijn rol in deze organisatie.
    redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=%2F`,
  });

  if (error || !data.user) {
    // De tekst van de fout gaat niet door naar het scherm: die kan de
    // configuratie van het mailkanaal beschrijven.
    console.error('Uitnodiging mislukt', { code: error?.status, name: error?.name });
    return { kind: 'FAILED', reason: error?.message ?? 'unknown' };
  }

  return { kind: 'INVITED', userId: data.user.id };
}
