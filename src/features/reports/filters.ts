import 'server-only';
import { requirePermission } from '@/features/rbac/session';
import { createClient } from '@/lib/supabase/server';
import { type FilterOption } from './components/scope-picker';

/**
 * De keuzelijsten boven de rapportage.
 *
 * Alleen locaties die daadwerkelijk in gebruik zijn, en alle opdrachtgevers.
 * De lijst is niet gepagineerd: een vervoerder met duizend opdrachtgevers
 * bestaat niet, en een keuzelijst die na de eerste vijftig ophoudt is erger dan
 * geen filter.
 */
export interface ReportFilterOptions {
  readonly careOrganizations: readonly FilterOption[];
  readonly locations: readonly FilterOption[];
}

export async function getFilterOptions(
  organizationId: string,
): Promise<ReportFilterOptions> {
  await requirePermission(organizationId, 'reports.view');
  const supabase = await createClient();

  const [careOrgs, locations] = await Promise.all([
    supabase
      .from('care_organizations')
      .select('id, name')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('locations')
      .select('id, name, care_organization_id')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('name'),
  ]);

  return {
    careOrganizations: (careOrgs.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
    })),
    locations: (locations.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      careOrganizationId: row.care_organization_id,
    })),
  };
}
