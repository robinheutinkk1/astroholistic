import 'server-only';
import { requirePermission, requireUser } from '@/features/rbac/session';
import { recordAudit } from '@/features/audit/service';
import * as repository from './repository';
import { type ReportPeriod } from './schema';

export type {
  AbsenceReasonRow,
  ClientRow,
  DayRow,
  DriverRow,
  RideSummary,
} from './repository';

export interface ReportBundle {
  readonly summary: repository.RideSummary;
  readonly perDay: readonly repository.DayRow[];
  readonly perDriver: readonly repository.DriverRow[];
  readonly perClient: readonly repository.ClientRow[];
  readonly absenceReasons: readonly repository.AbsenceReasonRow[];
}

/**
 * Everything the reporting screen shows, in one round trip's worth of
 * parallel queries.
 *
 * The permission check is here as well as in the SQL functions. Neither is
 * redundant: this one produces a proper error for the user, the one in the
 * database is the one a crafted PostgREST call still hits.
 */
export async function getReports(
  organizationId: string,
  period: ReportPeriod,
): Promise<ReportBundle> {
  await requirePermission(organizationId, 'reports.view');

  const [summary, perDay, perDriver, perClient, absenceReasons] = await Promise.all([
    repository.fetchSummary(organizationId, period),
    repository.fetchPerDay(organizationId, period),
    repository.fetchPerDriver(organizationId, period),
    repository.fetchPerClient(organizationId, period),
    repository.fetchAbsenceReasons(organizationId, period),
  ]);

  return { summary, perDay, perDriver, perClient, absenceReasons };
}

/**
 * Figures for a care organisation about the clients it funds.
 *
 * No permission check, deliberately: a care co-ordinator holds no membership
 * and therefore no `reports.view`. The boundary is the relationship, enforced
 * by `app.portal_client_ids()` inside the SQL function — the same helper the
 * portal itself uses, so a client whose funding period ended disappears from
 * both at once.
 */
export async function getPortalClientSummary(period: ReportPeriod) {
  await requireUser();
  return repository.fetchPortalClientSummary(period);
}

/**
 * Records that an export happened.
 *
 * This is not bookkeeping for its own sake. An export takes personal data out
 * of the system, where none of the controls in this product reach it any more,
 * so "who took what, and when" is the only thing left that can answer a
 * question afterwards (§53, docs/SECURITY.md §11). The period and the row
 * count are recorded; the contents are not.
 */
export async function recordExport(
  organizationId: string,
  kind: string,
  period: ReportPeriod,
  rowCount: number,
): Promise<void> {
  const user = await requireUser();
  await recordAudit({
    organizationId,
    actorUserId: user.id,
    action: 'report.exported',
    entityType: 'reports',
    entityId: null,
    metadata: { report: kind, from: period.from, to: period.to, rows: rowCount },
  });
}
