import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { csvFilename } from '@/features/reports/csv';
import {
  EXPORT_LABELS,
  perClientTable,
  perDayTable,
  perDriverTable,
  tableToCsv,
  type CsvTable,
} from '@/features/reports/export';
import { getReports, recordExport } from '@/features/reports/service';
import {
  reportPeriodSchema,
  REPORT_KINDS,
  type ReportKind,
} from '@/features/reports/schema';
import { requireUser } from '@/features/rbac/session';
import { consumeForUser } from '@/lib/security/rate-limit';

/**
 * CSV export of a report.
 *
 * A route handler rather than a Server Action, because the browser has to
 * receive a file: an action returns a value to React, not a download.
 *
 * Note what this does NOT do: it does not accept a list of columns, a filter or
 * a raw query from the caller. The three shapes below are the whole surface.
 * An export endpoint that assembles a query from user input is how a reporting
 * feature turns into a data-exfiltration tool with a friendly name.
 */
export const dynamic = 'force-dynamic';

function isReportKind(value: string | null): value is ReportKind {
  return value !== null && (REPORT_KINDS as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const membership = await getActiveMembership();
  // The proxy lets /api through without a redirect, so this is the first place
  // an unauthenticated request is stopped — and it must answer with a status
  // code, not an HTML login page.
  if (!membership) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const kind = params.get('kind');
  if (!isReportKind(kind)) {
    return NextResponse.json({ error: 'unknown_report' }, { status: 400 });
  }

  const period = reportPeriodSchema.safeParse({
    from: params.get('from'),
    to: params.get('to'),
  });
  if (!period.success) {
    return NextResponse.json({ error: 'invalid_period' }, { status: 400 });
  }

  // An export takes personal data out of the product. A planner making thirty
  // in an hour is not reporting, and a compromised session should not be able
  // to walk the whole client base out through this endpoint in a minute.
  const user = await requireUser();
  if (!(await consumeForUser('report-export', user.id))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // getReports checks reports.view and throws an AuthorizationError otherwise;
  // the SQL functions check it again.
  let reports;
  try {
    reports = await getReports(membership.organizationId, period.data);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const table: CsvTable =
    kind === 'per-dag'
      ? perDayTable(reports.perDay)
      : kind === 'per-chauffeur'
        ? perDriverTable(reports.perDriver)
        : perClientTable(reports.perClient);

  await recordExport(membership.organizationId, kind, period.data, table.rows.length);

  const filename = csvFilename(
    `${membership.organizationName}-${EXPORT_LABELS[kind]}`,
    period.data.from,
    period.data.to,
  );

  return new NextResponse(tableToCsv(table), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      // An export contains personal data. It must not sit in a shared cache,
      // and it must never be indexed.
      'cache-control': 'no-store, private',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
