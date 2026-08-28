import { afterAll, describe, expect, it } from 'vitest';
import { ORGS, USERS, asUser, disconnect, expectDenied, setupThenRead } from './harness';

/**
 * Support access is the one path by which someone outside an organisation can
 * read inside it. Everything about it is therefore conditional: the tenant
 * grants it, it expires, it can be revoked, it is read-only, and it comes in
 * two sizes.
 *
 * Grants are created inside the test transaction rather than seeded, so the
 * rest of the suite keeps proving that a platform administrator with no grant
 * sees nothing at all (S17).
 *
 * Matrix entries S39–S45 in docs/SECURITY.md.
 */
afterAll(disconnect);

const GRANT = `insert into support_access_grants
  (organization_id, granted_to_user_id, granted_by_user_id, reason, expires_at, scope)
  values ($1, $2, $3, 'Ticket 1234', now() + interval '2 hours', $4)`;

function grantThenRead(
  scope: 'OPERATIONAL' | 'PERSONAL',
  sql: string,
  params: unknown[] = [],
) {
  return setupThenRead(
    {
      sql: GRANT,
      params: [ORGS.a, USERS.platformAdmin, USERS.ownerA, scope],
    },
    { userId: USERS.platformAdmin, sql, params },
  );
}

describe('S39 — without a grant a platform administrator sees nothing', () => {
  it('no rides', async () => {
    const rows = await asUser(
      USERS.platformAdmin,
      'select id from rides where organization_id = $1',
      [ORGS.a],
    );
    expect(rows.rowCount).toBe(0);
  });

  it('no clients', async () => {
    const rows = await asUser(
      USERS.platformAdmin,
      'select id from clients where organization_id = $1',
      [ORGS.a],
    );
    expect(rows.rowCount).toBe(0);
  });
});

describe('S40 — an operational grant opens operations, not people', () => {
  it('opens rides', async () => {
    const rows = await grantThenRead(
      'OPERATIONAL',
      'select id from rides where organization_id = $1',
      [ORGS.a],
    );
    expect(rows.rowCount).toBeGreaterThan(0);
  });

  it('opens ride events, settings and the fleet', async () => {
    for (const table of ['ride_events', 'organization_settings', 'drivers', 'vehicles']) {
      const rows = await grantThenRead(
        'OPERATIONAL',
        `select 1 from ${table} where organization_id = $1 limit 1`,
        [ORGS.a],
      );
      expect({ table, rowCount: rows.rowCount }).toEqual({ table, rowCount: 1 });
    }
  });

  it('does NOT open clients', async () => {
    // The whole reason there are two scopes. A scheduling bug is diagnosed from
    // rides; it does not require a child's home address.
    const rows = await grantThenRead(
      'OPERATIONAL',
      'select id from clients where organization_id = $1',
      [ORGS.a],
    );
    expect(rows.rowCount).toBe(0);
  });

  it('does NOT open contacts', async () => {
    const rows = await grantThenRead(
      'OPERATIONAL',
      'select id from contacts where organization_id = $1',
      [ORGS.a],
    );
    expect(rows.rowCount).toBe(0);
  });
});

describe('S41 — a personal grant opens people too, and implies operational', () => {
  it('opens clients', async () => {
    const rows = await grantThenRead(
      'PERSONAL',
      'select id from clients where organization_id = $1',
      [ORGS.a],
    );
    expect(rows.rowCount).toBeGreaterThan(0);
  });

  it('still opens rides', async () => {
    // PERSONAL must imply OPERATIONAL. Otherwise the larger grant is somehow
    // narrower than the smaller one, which nobody would predict.
    const rows = await grantThenRead(
      'PERSONAL',
      'select id from rides where organization_id = $1',
      [ORGS.a],
    );
    expect(rows.rowCount).toBeGreaterThan(0);
  });
});

describe('S42 — a grant is bounded in time and can be withdrawn', () => {
  it('an expired grant opens nothing', async () => {
    const rows = await setupThenRead(
      {
        sql: `insert into support_access_grants
                (organization_id, granted_to_user_id, granted_by_user_id, reason, expires_at, scope, created_at)
              values ($1, $2, $3, 'Ticket 1234', now() - interval '1 hour', 'PERSONAL', now() - interval '2 hours')`,
        params: [ORGS.a, USERS.platformAdmin, USERS.ownerA],
      },
      {
        userId: USERS.platformAdmin,
        sql: 'select id from rides where organization_id = $1',
        params: [ORGS.a],
      },
    );
    expect(rows.rowCount).toBe(0);
  });

  it('a revoked grant opens nothing', async () => {
    const rows = await setupThenRead(
      {
        sql: `insert into support_access_grants
                (organization_id, granted_to_user_id, granted_by_user_id, reason, expires_at, scope, revoked_at)
              values ($1, $2, $3, 'Ticket 1234', now() + interval '2 hours', 'PERSONAL', now())`,
        params: [ORGS.a, USERS.platformAdmin, USERS.ownerA],
      },
      {
        userId: USERS.platformAdmin,
        sql: 'select id from rides where organization_id = $1',
        params: [ORGS.a],
      },
    );
    expect(rows.rowCount).toBe(0);
  });

  it('a grant for organisation A does not open organisation B', async () => {
    const rows = await grantThenRead(
      'PERSONAL',
      'select id from rides where organization_id = $1',
      [ORGS.b],
    );
    expect(rows.rowCount).toBe(0);
  });
});

describe('S43 — a grant to someone who is not platform staff opens nothing', () => {
  it('an outsider handed a grant still sees nothing', async () => {
    // Without this check, a former platform administrator would keep every
    // grant they held on the day they left.
    const rows = await setupThenRead(
      {
        sql: GRANT,
        params: [ORGS.a, USERS.outsider, USERS.ownerA, 'PERSONAL'],
      },
      {
        userId: USERS.outsider,
        sql: 'select id from rides where organization_id = $1',
        params: [ORGS.a],
      },
    );
    expect(rows.rowCount).toBe(0);
  });
});

describe('S44 — support is read-only', () => {
  it('cannot change a ride', async () => {
    const rows = await setupThenRead(
      { sql: GRANT, params: [ORGS.a, USERS.platformAdmin, USERS.ownerA, 'PERSONAL'] },
      {
        userId: USERS.platformAdmin,
        sql: "update rides set notes = 'support was here' where organization_id = $1",
        params: [ORGS.a],
      },
    );
    expect(rows.rowCount).toBe(0);
  });

  it('cannot change a client', async () => {
    const rows = await setupThenRead(
      { sql: GRANT, params: [ORGS.a, USERS.platformAdmin, USERS.ownerA, 'PERSONAL'] },
      {
        userId: USERS.platformAdmin,
        sql: "update clients set city = 'Elders' where organization_id = $1",
        params: [ORGS.a],
      },
    );
    expect(rows.rowCount).toBe(0);
  });

  it('cannot grant itself access', async () => {
    // The grant has to come from the tenant. If support could write this table,
    // every other assertion in this file would be decoration.
    await expectDenied(USERS.platformAdmin, GRANT, [
      ORGS.a,
      USERS.platformAdmin,
      USERS.platformAdmin,
      'PERSONAL',
    ]);
  });

  it('cannot extend a grant it was given', async () => {
    const rows = await setupThenRead(
      { sql: GRANT, params: [ORGS.a, USERS.platformAdmin, USERS.ownerA, 'PERSONAL'] },
      {
        userId: USERS.platformAdmin,
        sql: `update support_access_grants set expires_at = now() + interval '10 years'
                where organization_id = $1`,
        params: [ORGS.a],
      },
    );
    expect(rows.rowCount).toBe(0);
  });
});

describe('S45 — the tenant can see what support did', () => {
  it('the organisation reads its own grants', async () => {
    const rows = await setupThenRead(
      { sql: GRANT, params: [ORGS.a, USERS.platformAdmin, USERS.ownerA, 'OPERATIONAL'] },
      {
        userId: USERS.ownerA,
        sql: 'select reason, scope, expires_at from support_access_grants where organization_id = $1',
        params: [ORGS.a],
      },
    );
    expect(rows.rowCount).toBe(1);
  });

  it('another organisation cannot read those grants', async () => {
    const rows = await setupThenRead(
      { sql: GRANT, params: [ORGS.a, USERS.platformAdmin, USERS.ownerA, 'OPERATIONAL'] },
      {
        userId: USERS.ownerB,
        sql: 'select id from support_access_grants where organization_id = $1',
        params: [ORGS.a],
      },
    );
    expect(rows.rowCount).toBe(0);
  });
});

describe('S46 — a driver still reaches the vehicle on their own ride', () => {
  it('sees the vehicle assigned to their ride', async () => {
    // Not a support rule, but it lives in the same policy. Migration 0024 had
    // to drop and recreate vehicles_select to add one line, and the first draft
    // of that rewrite silently lost this clause. No test caught it, which is
    // why this one exists.
    const rows = await asUser(USERS.driverA1, 'select id from vehicles');
    expect(rows.rowCount).toBeGreaterThan(0);
  });

  it('but not a vehicle nobody assigned to them', async () => {
    const rows = await asUser(
      USERS.driverA1,
      `select v.id from vehicles v
        where not exists (
          select 1 from rides r where r.vehicle_id = v.id and r.driver_id = $1
        )`,
      ['50000000-0000-4000-8000-00000000000a'],
    );
    expect(rows.rowCount).toBe(0);
  });
});
