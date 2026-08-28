import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { publicEnv } from '@/lib/env';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { checkHostname, HOSTNAME_MESSAGES } from './hostname';
import * as repository from './repository';
import { nodeTxtResolver } from './dns';
import { getDomainProvider } from './provider-config';
import { checkDomainToken, type TxtResolver } from './verify';
import { markFailed, markVerified } from './verification-store';

export type { DomainRow } from './repository';

export async function listDomains(organizationId: string) {
  await requirePermission(organizationId, 'organization.view');
  return repository.findDomains(organizationId);
}

export async function addDomain(
  organizationId: string,
  rawHostname: string,
): Promise<Result<{ id: string }>> {
  const user = await requirePermission(organizationId, 'domain.manage');

  const checked = checkHostname(rawHostname, publicEnv.NEXT_PUBLIC_PLATFORM_HOST);
  if (!checked.ok) {
    return err(
      new ValidationError('Deze domeinnaam kan niet worden toegevoegd.', {
        hostname: [HOSTNAME_MESSAGES[checked.reason]],
      }),
    );
  }

  const inserted = await repository.insertDomain(organizationId, checked.hostname);
  if (!inserted.ok) {
    return err(
      inserted.duplicate
        ? new ConflictError('Deze domeinnaam staat al in de lijst.')
        : new ConflictError('De domeinnaam kon niet worden toegevoegd.'),
    );
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'domain.added',
    entityType: 'organization_domains',
    entityId: inserted.id,
  });

  return ok({ id: inserted.id });
}

export type VerifyResult =
  | { readonly status: 'VERIFIED' }
  /** Verified, but the hosting platform still needs a manual step (D-23). */
  | { readonly status: 'VERIFIED_MANUAL' }
  /** Verified, but attaching it at the hosting platform failed. */
  | { readonly status: 'VERIFIED_NOT_ATTACHED' }
  | { readonly status: 'NO_RECORD' }
  | { readonly status: 'TOKEN_MISMATCH' }
  | { readonly status: 'TAKEN' };

/**
 * Re-reads the token from the database rather than trusting anything the
 * caller sends: the whole point is that the tenant does not choose what they
 * are proving.
 */
export async function verifyDomain(
  organizationId: string,
  domainId: string,
  resolver?: TxtResolver,
): Promise<Result<VerifyResult>> {
  const user = await requirePermission(organizationId, 'domain.manage');

  const domain = await repository.findDomainById(organizationId, domainId);
  if (!domain) return err(new NotFoundError('Deze domeinnaam bestaat niet.'));

  const outcome = await checkDomainToken(
    domain.hostname,
    domain.verification_token,
    resolver ?? nodeTxtResolver,
  );

  if (!outcome.verified) {
    await markFailed(organizationId, domainId);
    await recordAudit({
      organizationId,
      actorUserId: user.id,
      action: 'domain.verification_failed',
      entityType: 'organization_domains',
      entityId: domainId,
    });
    return ok({ status: outcome.reason });
  }

  const written = await markVerified(organizationId, domainId);
  if (written === 'TAKEN') return ok({ status: 'TAKEN' });
  if (written === 'FAILED') {
    return err(new ConflictError('De verificatie kon niet worden opgeslagen.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'domain.verified',
    entityType: 'organization_domains',
    entityId: domainId,
  });

  // Ownership is proven and recorded. Attaching the hostname to the hosting
  // platform is a separate concern that may not be configured at all, and it
  // must not undo the verification if it fails — the DNS proof is still valid
  // and retrying costs nothing.
  const attached = await getDomainProvider().attach(domain.hostname);

  if (attached.status === 'MANUAL') return ok({ status: 'VERIFIED_MANUAL' });
  if (attached.status === 'FAILED') {
    console.error('Domain verified but not attached at the hosting platform', {
      organizationId,
      domainId,
      reason: attached.reason,
    });
    return ok({ status: 'VERIFIED_NOT_ATTACHED' });
  }

  return ok({ status: 'VERIFIED' });
}

export async function removeDomain(
  organizationId: string,
  domainId: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'domain.manage');

  const domain = await repository.findDomainById(organizationId, domainId);
  if (!domain) return err(new NotFoundError('Deze domeinnaam bestaat niet.'));

  const deleted = await repository.deleteDomain(organizationId, domainId);
  if (!deleted) return err(new ConflictError('Verwijderen is niet gelukt.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'domain.removed',
    entityType: 'organization_domains',
    entityId: domainId,
  });

  return ok(null);
}

export async function makePrimary(
  organizationId: string,
  domainId: string,
): Promise<Result<null>> {
  const user = await requirePermission(organizationId, 'domain.manage');

  const domain = await repository.findDomainById(organizationId, domainId);
  if (!domain) return err(new NotFoundError('Deze domeinnaam bestaat niet.'));
  if (domain.verification_status !== 'VERIFIED') {
    return err(
      new ConflictError('Alleen een geverifieerd domein kan het hoofddomein zijn.'),
    );
  }

  const updated = await repository.setPrimaryDomain(organizationId, domainId);
  if (!updated)
    return err(new ConflictError('Het hoofddomein kon niet worden gewijzigd.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'domain.primary_changed',
    entityType: 'organization_domains',
    entityId: domainId,
  });

  return ok(null);
}
