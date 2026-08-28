import { redirect } from 'next/navigation';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { getCurrentUser } from '@/features/rbac/session';

/**
 * De voordeur.
 *
 * Deze pagina toont niets: ze stuurt door. Wie hier terechtkomt is een planner,
 * een chauffeur of een ouder die naar zijn eigen scherm wil — niet iemand die
 * een productbeschrijving zoekt. Op het eigen domein van een vervoersbedrijf
 * zou zo'n beschrijving zelfs verwarrend zijn: die bezoeker weet allang van wie
 * de site is.
 *
 * De keuze gaat op permissies, niet op rollen (§5). Een organisatie die haar
 * rollen anders inricht wordt hier vanzelf goed doorgestuurd, zonder dat
 * iemand deze regel hoeft aan te passen.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const membership = await getActiveMembership();

  // Planner, dispatcher, eigenaar, meekijker.
  if (membership?.permissions.has('organization.view')) redirect('/dashboard');

  // Chauffeur: die heeft geen organisatiebrede leesrechten, wel zijn eigen
  // ritten. Naar de PWA, niet naar een planningsscherm vol lege tabellen.
  if (membership?.permissions.has('rides.view.assigned')) redirect('/driver');

  // Geen lidmaatschap: cliënt, contactpersoon of opdrachtgever. Het portaal legt
  // zelf uit wat er aan de hand is als er ook daar geen koppeling blijkt.
  redirect('/portaal');
}
