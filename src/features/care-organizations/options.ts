import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { createClient } from '@/lib/supabase/server';

export interface CareOrganizationOption {
  readonly id: string;
  readonly name: string;
}

/**
 * De opdrachtgevers om uit te kiezen, voor een keuzelijst.
 *
 * Gebruikt `care_organizations.view` en niet `.manage`: een planner die een
 * locatie invoert hoeft geen opdrachtgevers te mogen beheren om er een te
 * kunnen kiezen.
 */
export async function listCareOrganizationOptions(
  organizationId: string,
): Promise<CareOrganizationOption[]> {
  await requirePermission(organizationId, 'care_organizations.view');
  const supabase = await createClient();

  const { data } = await supabase
    .from('care_organizations')
    .select('id, name')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .eq('status', 'ACTIVE')
    .order('name');

  return data ?? [];
}
