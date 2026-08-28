import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMembership } from '@/features/organizations/active-organization';
import { exportClient } from '@/features/gdpr/service';
import { consumeForUser } from '@/lib/security/rate-limit';
import { requireUser } from '@/features/rbac/session';

/**
 * The data-subject export (AVG art. 15 and 20).
 *
 * JSON rather than CSV: this is one person's whole file, with nested contacts,
 * rides and requests. Flattening that into a spreadsheet would lose the shape
 * and is not what "a copy of the personal data undergoing processing" asks for.
 *
 * Rate-limited with the same bucket as the report export, because it is the
 * same risk with a sharper edge: one request here is one complete dossier.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const membership = await getActiveMembership();
  if (!membership) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const user = await requireUser();
  if (!(await consumeForUser('report-export', user.id))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const { clientId } = await params;

  let result;
  try {
    result = await exportClient(membership.organizationId, clientId);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return new NextResponse(JSON.stringify(result.data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // The client id, not the name: a filename ends up in a downloads folder,
      // a backup and a screen share.
      'content-disposition': `attachment; filename="clientgegevens-${clientId}.json"`,
      'cache-control': 'no-store, private',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
