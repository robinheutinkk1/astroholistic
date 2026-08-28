import { afterAll, describe, expect, it } from 'vitest';
import {
  adminConnect,
  asUser,
  CLIENTS,
  disconnect,
  DRIVERS,
  ORGS,
  USERS,
} from './harness';

/**
 * Realtime dispatch.
 *
 * WHAT CAN AND CANNOT BE TESTED HERE. Supabase Realtime is a separate service
 * that reads the replication stream and re-evaluates RLS per subscriber; it
 * needs the Docker stack, which this environment cannot pull. So the delivery
 * path itself is not exercised here.
 *
 * What IS tested is everything Realtime depends on: which tables are published,
 * whether they carry the data it needs, and — most importantly — that the RLS
 * policies it consults actually keep one organisation's rides away from
 * another's. If those hold, a leak through Realtime would require a bug in
 * Supabase rather than in this schema.
 */

afterAll(async () => {
  await disconnect();
});

const PUBLICATION = 'supabase_realtime';

describe('what is published', () => {
  it('publishes exactly the tables the board listens to', async () => {
    const db = await adminConnect();
    const result = await db.query<{ tablename: string }>(
      `select tablename from pg_publication_tables
       where pubname = $1 and schemaname = 'public'
       order by tablename`,
      [PUBLICATION],
    );
    expect(result.rows.map((r) => r.tablename)).toEqual([
      'ride_events',
      'rides',
      'trips',
    ]);
  });

  it('does NOT publish tables full of personal data', async () => {
    // Publishing clients or contacts would stream names and addresses to every
    // open board for edits nobody is waiting to see.
    const db = await adminConnect();
    const result = await db.query<{ tablename: string }>(
      `select tablename from pg_publication_tables
       where pubname = $1 and schemaname = 'public'
         and tablename in ('clients', 'contacts', 'drivers', 'profiles',
                           'nfc_tags', 'audit_logs')`,
      [PUBLICATION],
    );
    expect(result.rows).toEqual([]);
  });

  it('sends the previous row on an update, so bucket moves are detectable', async () => {
    const db = await adminConnect();
    const result = await db.query<{ relname: string; relreplident: string }>(
      `select relname, relreplident from pg_class
       where relname in ('rides', 'trips') and relnamespace = 'public'::regnamespace
       order by relname`,
    );
    // 'f' is FULL: without it an update arrives with only the primary key in
    // the old row, and the client cannot tell which column changed.
    expect(result.rows.every((r) => r.relreplident === 'f')).toBe(true);
  });

  it('every published table has row level security enabled', async () => {
    // Realtime consults RLS per subscriber. A published table without RLS would
    // broadcast every tenant's rows to every listener.
    const db = await adminConnect();
    const result = await db.query<{ tablename: string }>(
      `select t.tablename from pg_publication_tables p
       join pg_tables t on t.tablename = p.tablename and t.schemaname = p.schemaname
       where p.pubname = $1 and p.schemaname = 'public' and not t.rowsecurity`,
      [PUBLICATION],
    );
    expect(result.rows).toEqual([]);
  });
});

describe('the boundary Realtime relies on', () => {
  it("org B cannot read org A's rides", async () => {
    // This is the same policy Realtime evaluates before delivering a change.
    const result = await asUser<{ count: number }>(
      USERS.ownerB,
      'select count(*)::int as count from rides where organization_id = $1',
      [ORGS.a],
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it("org B cannot read org A's ride events", async () => {
    const result = await asUser<{ count: number }>(
      USERS.ownerB,
      'select count(*)::int as count from ride_events where organization_id = $1',
      [ORGS.a],
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it("org B cannot read org A's trips", async () => {
    const result = await asUser<{ count: number }>(
      USERS.ownerB,
      'select count(*)::int as count from trips where organization_id = $1',
      [ORGS.a],
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it('a driver would receive only their own rides', async () => {
    const result = await asUser<{ count: number }>(
      USERS.driverA1,
      'select count(*)::int as count from rides',
    );
    // One assigned ride, not the whole organisation's day.
    expect(result.rows[0]?.count).toBe(1);
  });
});

describe('access to the dispatch board', () => {
  it('a dispatcher holds rides.dispatch', async () => {
    const result = await asUser<{ permission_key: string }>(
      USERS.dispatcherA,
      `select permission_key from app.member_permissions()
       where organization_id = $1 and permission_key = 'rides.dispatch'`,
      [ORGS.a],
    );
    expect(result.rowCount).toBe(1);
  });

  it('a planner does not', async () => {
    // Planning and dispatching are different jobs; §4 separates them.
    const result = await asUser(
      USERS.plannerA,
      `select permission_key from app.member_permissions()
       where organization_id = $1 and permission_key = 'rides.dispatch'`,
      [ORGS.a],
    );
    expect(result.rowCount).toBe(0);
  });

  it('a driver does not', async () => {
    const result = await asUser(
      USERS.driverA1,
      `select permission_key from app.member_permissions()
       where organization_id = $1 and permission_key = 'rides.dispatch'`,
      [ORGS.a],
    );
    expect(result.rowCount).toBe(0);
  });
});

describe('the board reflects what actually happened', () => {
  it('picks up a status change immediately', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query(
        "update rides set status = 'DRIVER_EN_ROUTE' where id = '80000000-0000-4000-8000-00000000000a'",
      );
      const result = await db.query<{ status: string }>(
        "select status from rides where id = '80000000-0000-4000-8000-00000000000a'",
      );
      expect(result.rows[0]?.status).toBe('DRIVER_EN_ROUTE');
    } finally {
      await db.query('rollback');
    }
  });

  it('moves updated_at forward, which is what flags a stuck ride', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      const before = await db.query<{ updated_at: string }>(
        "select updated_at from rides where id = '80000000-0000-4000-8000-00000000000a'",
      );
      await db.query(
        "update rides set status = 'DRIVER_EN_ROUTE' where id = '80000000-0000-4000-8000-00000000000a'",
      );
      const after = await db.query<{ updated_at: string }>(
        "select updated_at from rides where id = '80000000-0000-4000-8000-00000000000a'",
      );
      expect(new Date(after.rows[0]!.updated_at).getTime()).toBeGreaterThan(
        new Date(before.rows[0]!.updated_at).getTime(),
      );
    } finally {
      await db.query('rollback');
    }
  });
});

describe('a driver reaches a ride through the assignment, not through the client', () => {
  it("does not see a colleague's ride for a client they also drive", async () => {
    // The leak migration 0020 closed. Kees drives Jan at 08:00, which makes Jan
    // visible to him — correct. It must NOT also show him the 16:00 group trip
    // Sanne drives: that is a colleague's assignment and Jan's full daily
    // movement pattern, which docs/SECURITY.md §1 treats as sensitive as an
    // address.
    const result = await asUser<{ driver_id: string | null }>(
      USERS.driverA1,
      'select driver_id from rides',
    );
    expect(result.rows.every((row) => row.driver_id === DRIVERS.keesA)).toBe(true);
  });

  it('still sees the client of their own ride', async () => {
    // Tightening ride visibility must not blind a driver to who they are
    // collecting.
    const result = await asUser<{ count: number }>(
      USERS.driverA1,
      'select count(*)::int as count from clients where id = $1',
      [CLIENTS.janA],
    );
    expect(result.rows[0]?.count).toBe(1);
  });

  it('a parent still sees every ride of their own child', async () => {
    // The portal path is unchanged: a parent follows the client, not a driver
    // assignment, so they see both the morning and the afternoon trip.
    const result = await asUser<{ count: number }>(
      USERS.parentA,
      'select count(*)::int as count from rides where client_id = $1',
      [CLIENTS.janA],
    );
    expect(result.rows[0]?.count).toBeGreaterThan(1);
  });

  it('a care organisation still sees the rides of the client it funds', async () => {
    const result = await asUser<{ count: number }>(
      USERS.careA,
      'select count(*)::int as count from rides where client_id = $1',
      [CLIENTS.janA],
    );
    expect(result.rows[0]?.count).toBeGreaterThan(0);
  });

  it('a client still sees their own rides', async () => {
    const result = await asUser<{ count: number }>(
      USERS.clientA,
      'select count(*)::int as count from rides',
    );
    expect(result.rows[0]?.count).toBeGreaterThan(0);
  });
});
