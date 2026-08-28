'use server';

import { revalidatePath } from 'next/cache';
import { getActiveMembership } from '@/features/organizations/active-organization';
import {
  fromValidationIssues,
  toFormState,
  type FormState,
} from '@/lib/errors/form-state';
import { MAX_LOGO_BYTES } from './image';
import { brandingFormSchema } from './schema';
import * as service from './service';

const CONTEXT = 'branding action';

export async function updateBrandingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const parsed = brandingFormSchema.safeParse({
    displayName: formData.get('displayName'),
    primaryColor: formData.get('primaryColor'),
    secondaryColor: formData.get('secondaryColor'),
    supportEmail: formData.get('supportEmail'),
    supportPhone: formData.get('supportPhone'),
    hidePlatformBranding: formData.get('hidePlatformBranding'),
  });
  if (!parsed.success) return fromValidationIssues(parsed.error.flatten().fieldErrors);

  try {
    const result = await service.updateBranding(membership.organizationId, parsed.data);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  // Branding is read in the root layouts, so the whole tree is stale.
  revalidatePath('/', 'layout');
  return { status: 'success', message: 'De huisstijl is opgeslagen.' };
}

export async function uploadLogoAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    return fromValidationIssues({ logo: ['Kies een bestand.'] });
  }

  // Checked before the bytes are read into memory. checkLogo enforces the same
  // limit on what was actually received; this only avoids buffering a 4 GB
  // upload to reject it a moment later.
  if (file.size > MAX_LOGO_BYTES) {
    return fromValidationIssues({ logo: ['Het logo mag maximaal 512 kB zijn.'] });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const result = await service.replaceLogo(membership.organizationId, bytes);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: 'Het logo is geüpload.' };
}

export async function removeLogoAction(
  _previous: FormState,
  _formData: FormData,
): Promise<FormState> {
  const membership = await getActiveMembership();
  if (!membership) return { status: 'error', message: 'Geen actieve organisatie.' };

  try {
    const result = await service.removeLogo(membership.organizationId);
    if (!result.ok) return toFormState(result.error, CONTEXT);
  } catch (error) {
    return toFormState(error, CONTEXT);
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: 'Het logo is verwijderd.' };
}
