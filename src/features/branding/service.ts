import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { ConflictError, ValidationError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import * as repository from './repository';
import { type BrandingFormInput } from './schema';
import { LOGO_FORMATS } from './url';
import { checkLogo, logoObjectPath, type LogoRejection } from './image';

export type { BrandingRow } from './repository';

export async function getBranding(organizationId: string) {
  // Any member may *see* the branding — they already see it painted on every
  // page. Changing it needs branding.manage.
  await requirePermission(organizationId, 'organization.view');
  return repository.findBranding(organizationId);
}

/**
 * Branding for a viewer who is not a member: a parent, a client, a care
 * co-ordinator on the portal.
 *
 * Deliberately without a permission check. Those viewers hold no membership
 * and therefore no permissions at all, so `requirePermission` would refuse the
 * one group white label exists for. RLS is the boundary here — migration 0021
 * extends the branding SELECT policy to the organisations a portal user
 * already reaches clients in, and a request for any other organisation simply
 * returns nothing.
 */
export async function readBrandingForViewer(organizationId: string) {
  return repository.findBranding(organizationId);
}

export async function updateBranding(
  organizationId: string,
  input: BrandingFormInput,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'branding.manage');

  const saved = await repository.saveBranding(organizationId, input);
  if (!saved) return err(new ConflictError('De huisstijl kon niet worden opgeslagen.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'branding.updated',
    entityType: 'organization_branding',
    entityId: organizationId,
    changedFields: Object.keys(input),
  });

  return ok(null);
}

const REJECTION_MESSAGES: Record<LogoRejection, string> = {
  EMPTY: 'Kies een bestand.',
  TOO_LARGE: 'Het logo mag maximaal 512 kB zijn.',
  UNSUPPORTED_FORMAT: 'Gebruik een PNG-, JPG- of WebP-bestand.',
  SVG_NOT_ALLOWED:
    'SVG wordt niet geaccepteerd. Een SVG kan scripts bevatten; gebruik PNG of WebP.',
};

/**
 * Stores a new logo.
 *
 * The order matters. The file is inspected first, then written to storage, and
 * only then recorded on the branding row — so a rejected or failed upload can
 * never leave the database pointing at an object that is not there.
 */
export async function replaceLogo(
  organizationId: string,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<Result<{ path: string }>> {
  const user = await requirePermission(organizationId, 'branding.manage');

  const check = checkLogo(bytes);
  if (!check.ok) {
    return err(
      new ValidationError('Dit bestand kan niet als logo worden gebruikt.', {
        logo: [REJECTION_MESSAGES[check.reason]],
      }),
    );
  }

  const path = logoObjectPath(organizationId, check.format);
  const uploaded = await repository.uploadLogo(path, bytes, check.contentType);
  if (!uploaded) return err(new ConflictError('Het logo kon niet worden opgeslagen.'));

  const saved = await repository.saveLogoPath(organizationId, path);
  if (!saved) return err(new ConflictError('Het logo kon niet worden opgeslagen.'));

  await repository.removeOtherLogoObjects(organizationId, check.format, LOGO_FORMATS);

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'branding.logo_replaced',
    entityType: 'organization_branding',
    entityId: organizationId,
  });

  return ok({ path });
}

export async function removeLogo(organizationId: string): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'branding.manage');

  // Clear the reference before deleting the bytes: a page rendered in between
  // then shows no logo rather than a broken image.
  const saved = await repository.saveLogoPath(organizationId, null);
  if (!saved) return err(new ConflictError('Het logo kon niet worden verwijderd.'));

  await repository.removeOtherLogoObjects(organizationId, null, LOGO_FORMATS);

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'branding.logo_removed',
    entityType: 'organization_branding',
    entityId: organizationId,
  });

  return ok(null);
}
