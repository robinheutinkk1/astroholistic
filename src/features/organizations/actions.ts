'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { setActiveOrganization } from './active-organization';

/**
 * Wisselen van organisatie.
 *
 * Neemt de id als argument in plaats van FormData, omdat er geen formulier meer
 * omheen zit. Dat formulier stond eerst binnenin een Radix-menu-item, en dat
 * werkte niet: het item vangt de klik af en sluit het menu, waardoor React het
 * formulier weghaalt voordat de browser het kan versturen. Er gebeurde
 * letterlijk niets.
 *
 * Na het wisselen gaat de gebruiker naar de voordeur, niet terug naar de pagina
 * waar hij stond. Die pagina kan van de vórige organisatie zijn — een cliënt of
 * rit die in de nieuwe organisatie niet bestaat — en dan zou het wisselen
 * eindigen op "niet gevonden". De voordeur stuurt hem door op basis van zijn
 * rechten in de nieuwe organisatie.
 */
export async function switchOrganizationAction(organizationId: string): Promise<void> {
  // setActiveOrganization verifieert het lidmaatschap; een verzonnen id doet niets.
  const switched = await setActiveOrganization(organizationId);
  if (!switched) return;

  revalidatePath('/', 'layout');
  redirect('/');
}
