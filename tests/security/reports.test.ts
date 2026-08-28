import { afterAll, describe, expect, it } from 'vitest';
import { ORGS, USERS, asUser, disconnect, expectDenied } from './harness';

/**
 * Reporting aggregates rows the caller may not be allowed to see one by one.
 * That makes a report the classic way a tenant boundary springs a leak while
 * every individual screen still looks correct: a count is derived data, and
 * derived data leaks just as effectively as the rows behind it.
 *
 * The functions in migration 0022 are `security invoker` precisely so RLS still
 * applies. These assertions exist to prove that, and to fail loudly if someone
 * ever "fixes a permission problem" by adding SECURITY DEFINER.
 *
 * Matrix entries S31–S38 in docs/SECURITY.md.
 */
afterAll(disconnect);

const PERIOD = 'current_date - 60, current_date - 1';

async function summaryTotal(userId: string | null, organizationId: string) {
  const rows = await asUser<{ total: string | null }>(
    userId,
    `select total from report_ride_summary($1, ${PERIOD})`,
    [organizationId],
  );
  return Number(rows.rows[0]?.total ?? 0);
}

describe('S31 — a report never crosses the tenant boundary', () => {
  it('a planner of A sees As rides', async () => {
    expect(await summaryTotal(USERS.plannerA, ORGS.a)).toBeGreaterThan(0);
  });

  it('an owner of B sees Bs rides', async () => {
    expect(await summaryTotal(USERS.ownerB, ORGS.b)).toBeGreaterThan(0);
  });

  it('the two organisations do not see the same number', async () => {
    // A shared number would mean the aggregate is running over both tenants —
    // the exact failure this whole file exists to catch.
    const a = await summaryTotal(USERS.plannerA, ORGS.a);
    const b = await summaryTotal(USERS.ownerB, ORGS.b);
    expect(a).not.toBe(b);
  });

  it('a planner of A asking for B gets nothing', async () => {
    expect(await summaryTotal(USERS.plannerA, ORGS.b)).toBe(0);
  });

  it('an owner of B asking for A gets nothing', async () => {
    expect(await summaryTotal(USERS.ownerB, ORGS.a)).toBe(0);
  });

  it('every report function refuses the other organisation', async () => {
    for (const fn of [
      'report_rides_per_day',
      'report_by_driver',
      'report_by_client',
      'report_absence_reasons',
    ]) {
      const rows = await asUser(USERS.plannerA, `select * from ${fn}($1, ${PERIOD})`, [
        ORGS.b,
      ]);
      expect({ fn, rowCount: rows.rowCount }).toEqual({ fn, rowCount: 0 });
    }
  });
});

describe('S31b — the report functions run as the caller, not as their owner', () => {
  it('none of them is SECURITY DEFINER', async () => {
    // This is asserted against the catalogue rather than through behaviour, and
    // that is deliberate. Making these SECURITY DEFINER does *not* break any
    // test above: the explicit `app.has_permission()` check inside each
    // function reads the caller's own JWT and keeps refusing the wrong
    // organisation, so the tenant tests stay green while RLS on `rides` has
    // quietly stopped applying. A behavioural test cannot see that difference
    // today; the day someone adds a row-level rule to `rides`, it would matter
    // very much. So the property itself is asserted.
    const rows = await asUser<{ proname: string; prosecdef: boolean }>(
      USERS.plannerA,
      `select p.proname, p.prosecdef
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'report\\_%'
        order by p.proname`,
    );

    expect(rows.rowCount).toBeGreaterThanOrEqual(6);
    expect(rows.rows.filter((row) => row.prosecdef)).toEqual([]);
  });
});

describe('S32 — reports need reports.view', () => {
  it('a driver gets nothing, even for their own organisation', async () => {
    // A driver can legitimately read their own assigned rides, so RLS alone
    // would hand them a report of themselves. The permission check in the
    // function is what makes the answer empty rather than partial.
    expect(await summaryTotal(USERS.driverA1, ORGS.a)).toBe(0);
  });

  it('a driver gets nothing from the per-driver report', async () => {
    const rows = await asUser(
      USERS.driverA1,
      `select * from report_by_driver($1, ${PERIOD})`,
      [ORGS.a],
    );
    expect(rows.rowCount).toBe(0);
  });

  it('a parent gets nothing from the organisation reports', async () => {
    expect(await summaryTotal(USERS.parentA, ORGS.a)).toBe(0);
  });

  it('an outsider gets nothing', async () => {
    expect(await summaryTotal(USERS.outsider, ORGS.a)).toBe(0);
  });

  it('an anonymous caller cannot execute a report at all', async () => {
    const message = await expectDenied(
      null,
      `select * from report_ride_summary($1, ${PERIOD})`,
      [ORGS.a],
    );
    expect(message).toContain('permission denied');
  });
});

describe('S33 — a platform administrator gets no tenant figures', () => {
  it('returns nothing, consistent with decision D-02', async () => {
    // Platform admins deliberately hold no tenant permissions. A report is not
    // the back door around that.
    expect(await summaryTotal(USERS.platformAdmin, ORGS.a)).toBe(0);
  });
});

describe('S34 — the figures are internally consistent', () => {
  it('the day rows add up to the summary total', async () => {
    const summary = await summaryTotal(USERS.plannerA, ORGS.a);
    const days = await asUser<{ sum: string | null }>(
      USERS.plannerA,
      `select sum(total)::text as sum from report_rides_per_day($1, ${PERIOD})`,
      [ORGS.a],
    );
    expect(Number(days.rows[0]?.sum ?? 0)).toBe(summary);
  });

  it('the driver rows add up to the summary total, including rides with no driver', async () => {
    // This is what the LEFT JOIN in report_by_driver buys. The seed contains
    // cancelled rides that never got a driver; an inner join drops them and
    // these two numbers drift apart with no error anywhere. Without those rows
    // in the fixture this assertion would pass for the wrong reason.
    const unassigned = await asUser<{ count: string }>(
      USERS.plannerA,
      `select count(*)::text as count from report_by_driver($1, ${PERIOD}) where driver_id is null`,
      [ORGS.a],
    );
    expect(Number(unassigned.rows[0]?.count ?? 0)).toBe(1);

    const summary = await summaryTotal(USERS.plannerA, ORGS.a);
    const drivers = await asUser<{ sum: string | null }>(
      USERS.plannerA,
      `select sum(total)::text as sum from report_by_driver($1, ${PERIOD})`,
      [ORGS.a],
    );
    expect(Number(drivers.rows[0]?.sum ?? 0)).toBe(summary);
  });

  it('the client rows add up to the summary total', async () => {
    const summary = await summaryTotal(USERS.plannerA, ORGS.a);
    const clients = await asUser<{ sum: string | null }>(
      USERS.plannerA,
      `select sum(total)::text as sum from report_by_client($1, ${PERIOD})`,
      [ORGS.a],
    );
    expect(Number(clients.rows[0]?.sum ?? 0)).toBe(summary);
  });

  it('punctuality is only counted where a check-in happened', async () => {
    const rows = await asUser<{ measured: string; on_time: string; late: string }>(
      USERS.plannerA,
      `select measured::text, on_time::text, late::text
         from report_ride_summary($1, ${PERIOD})`,
      [ORGS.a],
    );
    const row = rows.rows[0];
    // A cancelled ride has no check-in and must not be counted as "on time";
    // that would flatter every punctuality figure in the product.
    expect(Number(row?.on_time) + Number(row?.late)).toBe(Number(row?.measured));
  });
});

describe('S35 — no illness tally per person', () => {
  it('report_by_client exposes no absence reason', async () => {
    // One of the reasons is ILL. A per-person count of those is a health
    // record, which this product does not keep (D-03, D-25).
    const rows = await asUser(
      USERS.plannerA,
      `select * from report_by_client($1, ${PERIOD}) limit 1`,
      [ORGS.a],
    );
    expect(Object.keys(rows.rows[0] ?? {})).toEqual([
      'client_id',
      'client_name',
      'total',
      'completed',
      'absent',
      'cancelled',
      'last_ride_date',
    ]);
  });

  it('the organisation-wide breakdown does exist, without naming anyone', async () => {
    const rows = await asUser(
      USERS.plannerA,
      `select * from report_absence_reasons($1, ${PERIOD})`,
      [ORGS.a],
    );
    expect(rows.rowCount).toBeGreaterThan(0);
    expect(Object.keys(rows.rows[0] ?? {})).toEqual(['reason', 'total']);
  });
});

describe('S36 — the portal report is scoped by relationship', () => {
  it('a parent sees only their own child', async () => {
    const rows = await asUser<{ client_id: string }>(
      USERS.parentA,
      `select client_id from report_portal_client_summary(${PERIOD})`,
    );
    // Olga is linked to Jan only. Piet belongs to the same organisation and
    // must not appear.
    expect(rows.rowCount).toBe(1);
  });

  it('a care organisation sees the clients it funds', async () => {
    const rows = await asUser(
      USERS.careA,
      `select client_id from report_portal_client_summary(${PERIOD})`,
    );
    expect(rows.rowCount).toBeGreaterThan(0);
  });

  it('an outsider sees nothing', async () => {
    const rows = await asUser(
      USERS.outsider,
      `select * from report_portal_client_summary(${PERIOD})`,
    );
    expect(rows.rowCount).toBe(0);
  });

  it('a planner has no portal relationships and so gets nothing here', async () => {
    // The portal function is scoped by relationship, not by membership. A
    // planner reading it is not an error, it is simply empty.
    const rows = await asUser(
      USERS.plannerA,
      `select * from report_portal_client_summary(${PERIOD})`,
    );
    expect(rows.rowCount).toBe(0);
  });
});

describe('S37 — an export is written to the audit trail', () => {
  it('a planner may record an export for their own organisation', async () => {
    const result = await asUser(
      USERS.plannerA,
      `insert into audit_logs (organization_id, actor_user_id, actor_kind, action, entity_type, metadata)
       values ($1, $2, 'PLANNER', 'report.exported', 'reports', '{"rows": 3}'::jsonb)`,
      [ORGS.a, USERS.plannerA],
    );
    expect(result.rowCount).toBe(1);
  });

  it('and cannot record one against another organisation', async () => {
    await expectDenied(
      USERS.plannerA,
      `insert into audit_logs (organization_id, actor_user_id, actor_kind, action, entity_type)
       values ($1, $2, 'PLANNER', 'report.exported', 'reports')`,
      [ORGS.b, USERS.plannerA],
    );
  });

  it('and cannot delete the record afterwards', async () => {
    // The point of auditing an export is that it cannot be taken back.
    await expectDenied(
      USERS.plannerA,
      "delete from audit_logs where action = 'report.exported'",
    );
  });
});
