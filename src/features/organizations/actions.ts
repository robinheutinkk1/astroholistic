'use server';

import { revalidatePath } from 'next/cache';
import { setActiveOrganization } from './active-organization';

export async function switchOrganizationAction(formData: FormData): Promise<void> {
  const organizationId = formData.get('organizationId');
  if (typeof organizationId !== 'string') return;

  // setActiveOrganization verifies membership; a forged id simply does nothing.
  await setActiveOrganization(organizationId);
  revalidatePath('/', 'layout');
}
