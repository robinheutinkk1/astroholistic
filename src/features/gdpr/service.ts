import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import { ConflictError, NotFoundError } from '@/lib/errors/app-error';
import { err, ok, type Result } from '@/lib/result/result';
import { createClient } from '@/lib/supabase/server';
/*
 * The sixth legitimate service-role job (see src/lib/supabase/admin.ts).
 *
 * Anonymising the client row is an ordinary RLS-checked write. Removing the
 * *login account* is not: it lives in `auth.users`, which no tenant may touch.
 * Leaving it behind would mean an "erased" person's e-mail address is still in
 * the system, which is not erasure at all.
 */
// eslint-disable-next-line no-restricted-imports
import { createUnscopedAdminClient } from '@/lib/supabase/admin';

/**
 * Everything the system holds about one person (AVG art. 15 and 20).
 *
 * The document is assembled by a SECURITY INVOKER function, so a caller who
 * may not read this client gets nothing rather than a leak.
 */
export async function exportClient(
  organizationId: string,
  clientId: string,
): Promise<Result<unknown>> {
  const user = await requirePermission(organizationId, 'clients.view');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('export_client_data', {
    p_organization_id: organizationId,
    p_client_id: clientId,
  });

  if (error) return err(new ConflictError('De export kon niet worden gemaakt.'));
  if (data === null) return err(new NotFoundError('Deze cliënt bestaat niet.'));

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'client.exported',
    entityType: 'clients',
    entityId: clientId,
  });

  return ok(data);
}

/**
 * Erases a person while keeping the transport record (AVG art. 17).
 *
 * Three steps, in this order and no other:
 *   1. anonymise the client, its orphaned contacts and its tags — RLS-checked;
 *   2. audit it, while we still know it happened;
 *   3. remove the login account, which is the part that cannot be undone.
 *
 * If step 3 fails the person is already unidentifiable in this product and the
 * failure is logged; retrying is safe because step 1 is idempotent.
 */
export async function eraseClient(
  organizationId: string,
  clientId: string,
): Promise<Result<{ contactsAnonymized: number }>> {
  const user = await requirePermission(organizationId, 'clients.delete');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('anonymize_client', {
    p_organization_id: organizationId,
    p_client_id: clientId,
  });

  if (error) return err(new ConflictError('De gegevens konden niet worden gewist.'));

  const result = data?.[0];
  if (!result) {
    // No row changed: not visible to this caller, another organisation, or
    // already anonymised. All three are "nothing to do" and must look alike.
    return err(new NotFoundError('Deze cliënt bestaat niet of is al gewist.'));
  }

  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'client.anonymized',
    entityType: 'clients',
    entityId: clientId,
    metadata: { contacts_anonymized: result.contacts_anonymized ?? 0 },
  });

  if (result.detached_user_id) {
    try {
      const admin = createUnscopedAdminClient(
        'GDPR erasure: the login account lives in auth.users, outside every tenant boundary',
      );
      const { error: deleteError } = await admin.auth.admin.deleteUser(
        result.detached_user_id,
      );
      if (deleteError) {
        console.error('Erasure left a login account behind', {
          organizationId,
          clientId,
          code: deleteError.status,
        });
      }
    } catch (deleteError) {
      console.error('Erasure could not remove the login account', {
        organizationId,
        clientId,
        message: deleteError instanceof Error ? deleteError.message : 'unknown',
      });
    }
  }

  return ok({ contactsAnonymized: result.contacts_anonymized ?? 0 });
}
