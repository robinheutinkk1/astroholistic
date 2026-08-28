import { afterAll, describe, expect, it } from 'vitest';
import {
  adminConnect,
  asUser,
  disconnect,
  expectDenied,
  ORGS,
  RIDES,
  TAGS,
  USERS,
} from './harness';

/**
 * NFC/QR check-in.
 *
 * The riskiest surface in the product: a URL printed on a physical object that
 * anyone can pick up. These tests attack it from every angle a found tag,
 * a curious employee, or a competing organisation could.
 */

/** Matches the hash the application computes; the pepper is irrelevant here. */
const TOKEN_A = "digest('TESTTOKEN-A' || 'pepper', 'sha256')";
const TOKEN_B = "digest('TESTTOKEN-B' || 'pepper', 'sha256')";

const DRIVER_KEES = 'a0000000-0000-4000-8000-000000000004';
const DRIVER_SANNE = 'a0000000-0000-4000-8000-000000000005';

afterAll(async () => {
  await disconnect();
});

/** Runs the check-in function as a given user, inside a rolled-back transaction. */
async function scan(
  userId: string,
  tokenExpr: string,
  setup: string[] = [],
): Promise<{ outcome: string; name: string | null }> {
  const db = await adminConnect();
  await db.query('begin');
  try {
    for (const statement of setup) await db.query(statement);

    await db.query('set local role authenticated');
    await db.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);

    const result = await db.query<{ outcome: string; client_first_name: string | null }>(
      `select outcome, client_first_name from public.checkin_by_tag_token(${tokenExpr}, 'NFC')`,
    );
    return {
      outcome: result.rows[0]?.outcome ?? 'NONE',
      name: result.rows[0]?.client_first_name ?? null,
    };
  } finally {
    await db.query('rollback');
  }
}

const GIVE_TOKEN_A = `update nfc_tags set token_hash = ${TOKEN_A} where id = '${TAGS.janA}'`;
const GIVE_TOKEN_B = `update nfc_tags set token_hash = ${TOKEN_B} where id = '${TAGS.klaasB}'`;
const RIDE_EN_ROUTE = `update rides set status = 'DRIVER_EN_ROUTE' where id = '${RIDES.janA}'`;

describe('the happy path', () => {
  it('checks the client in and returns their name', async () => {
    const result = await scan(DRIVER_KEES, TOKEN_A, [GIVE_TOKEN_A, RIDE_EN_ROUTE]);
    expect(result.outcome).toBe('CHECKED_IN');
    expect(result.name).toBe('Jan');
  });

  it('writes exactly one check-in event', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query(GIVE_TOKEN_A);
      await db.query(RIDE_EN_ROUTE);
      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: DRIVER_KEES, role: 'authenticated' }),
      ]);

      for (let i = 0; i < 3; i += 1) {
        await db.query(`select * from public.checkin_by_tag_token(${TOKEN_A}, 'NFC')`);
      }

      const events = await db.query<{ count: string }>(
        `select count(*)::text as count from ride_events
         where ride_id = $1 and event_type = 'CLIENT_CHECKED_IN'`,
        [RIDES.janA],
      );
      // Three taps, one event. The driver taps again because nothing visibly
      // happened; that is not three check-ins (masterprompt §60).
      expect(events.rows[0]?.count).toBe('1');
    } finally {
      await db.query('rollback');
    }
  });

  it('reports a repeat scan as already checked in, not as an error', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query(GIVE_TOKEN_A);
      await db.query(RIDE_EN_ROUTE);
      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: DRIVER_KEES, role: 'authenticated' }),
      ]);

      await db.query(`select * from public.checkin_by_tag_token(${TOKEN_A}, 'NFC')`);
      const second = await db.query<{ outcome: string; client_first_name: string }>(
        `select outcome, client_first_name from public.checkin_by_tag_token(${TOKEN_A}, 'QR')`,
      );
      expect(second.rows[0]?.outcome).toBe('ALREADY_CHECKED_IN');
      expect(second.rows[0]?.client_first_name).toBe('Jan');
    } finally {
      await db.query('rollback');
    }
  });

  it('records how the check-in happened, so NFC and manual stay distinguishable', async () => {
    // Decision D-18: manual check-off is allowed, but the reporting must show
    // whether the tags are really being used.
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query(GIVE_TOKEN_A);
      await db.query(RIDE_EN_ROUTE);
      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: DRIVER_KEES, role: 'authenticated' }),
      ]);
      await db.query(`select * from public.checkin_by_tag_token(${TOKEN_A}, 'NFC')`);

      const result = await db.query<{ source: string; method: string }>(
        `select e.source, r.checked_in_method as method
         from ride_events e join rides r on r.id = e.ride_id
         where e.ride_id = $1 and e.event_type = 'CLIENT_CHECKED_IN'`,
        [RIDES.janA],
      );
      expect(result.rows[0]?.source).toBe('NFC');
      expect(result.rows[0]?.method).toBe('NFC');
    } finally {
      await db.query('rollback');
    }
  });

  it('moves a driver who has not reported arriving along, rather than refusing', async () => {
    // The tap itself is proof of presence; blocking would strand the driver at
    // the door with no way forward.
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query(GIVE_TOKEN_A);
      await db.query(RIDE_EN_ROUTE);
      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: DRIVER_KEES, role: 'authenticated' }),
      ]);
      await db.query(`select * from public.checkin_by_tag_token(${TOKEN_A}, 'NFC')`);

      const events = await db.query<{ event_type: string }>(
        `select event_type from ride_events where ride_id = $1 order by occurred_at`,
        [RIDES.janA],
      );
      const types = events.rows.map((r) => r.event_type);
      expect(types).toContain('DRIVER_ARRIVED');
      expect(types).toContain('CLIENT_CHECKED_IN');
    } finally {
      await db.query('rollback');
    }
  });
});

describe('a found tag is worthless', () => {
  it('tells an unknown token nothing', async () => {
    const result = await scan(DRIVER_KEES, "digest('NOT-A-REAL-TOKEN', 'sha256')");
    expect(result.outcome).toBe('UNKNOWN_TAG');
    expect(result.name).toBeNull();
  });

  it("gives the same answer for another organisation's tag as for an unknown one", async () => {
    // If these differed, the endpoint would be an oracle for finding real tags.
    const unknown = await scan(DRIVER_KEES, "digest('NOPE', 'sha256')");
    const foreign = await scan(DRIVER_KEES, TOKEN_B, [GIVE_TOKEN_B]);
    expect(foreign.outcome).toBe(unknown.outcome);
    expect(foreign.name).toBeNull();
  });

  it('gives an inactive tag the same answer as an unknown one', async () => {
    const result = await scan(DRIVER_KEES, TOKEN_A, [
      GIVE_TOKEN_A,
      `update nfc_tags set status = 'INACTIVE' where id = '${TAGS.janA}'`,
    ]);
    expect(result.outcome).toBe('UNKNOWN_TAG');
    expect(result.name).toBeNull();
  });

  it('a tag reported lost stops working immediately', async () => {
    const result = await scan(DRIVER_KEES, TOKEN_A, [
      GIVE_TOKEN_A,
      RIDE_EN_ROUTE,
      `update nfc_tags set status = 'LOST', client_id = null where id = '${TAGS.janA}'`,
    ]);
    expect(result.outcome).toBe('UNKNOWN_TAG');
  });
});

describe('scanning does not grant access', () => {
  it('a driver from another organisation is told the tag does not exist', async () => {
    // Not NO_ACCESS: that would confirm the token is real. From their side the
    // tag simply is not there, which is the same answer a random string gets.
    const result = await scan(USERS.driverB, TOKEN_A, [GIVE_TOKEN_A, RIDE_EN_ROUTE]);
    expect(result.outcome).toBe('UNKNOWN_TAG');
    expect(result.name).toBeNull();
  });

  it('a colleague without this ride gets no ride and no name', async () => {
    const result = await scan(DRIVER_SANNE, TOKEN_A, [GIVE_TOKEN_A, RIDE_EN_ROUTE]);
    expect(result.outcome).toBe('NO_ACTIVE_RIDE');
    expect(result.name).toBeNull();
  });

  // NO_ACCESS is now reserved for callers who are not a driver anywhere. That
  // says something about the caller, not about whether the tag exists.
  it('a planner is not a driver and gets no access', async () => {
    const result = await scan(USERS.plannerA, TOKEN_A, [GIVE_TOKEN_A, RIDE_EN_ROUTE]);
    expect(result.outcome).toBe('NO_ACCESS');
    expect(result.name).toBeNull();
  });

  it('an outsider with an account gets no access', async () => {
    const result = await scan(USERS.outsider, TOKEN_A, [GIVE_TOKEN_A, RIDE_EN_ROUTE]);
    expect(result.outcome).toBe('NO_ACCESS');
  });

  it('says nothing when there is no ride today', async () => {
    const result = await scan(DRIVER_KEES, TOKEN_A, [
      GIVE_TOKEN_A,
      `update rides set scheduled_date = current_date + 30 where id = '${RIDES.janA}'`,
    ]);
    expect(result.outcome).toBe('NO_ACTIVE_RIDE');
    expect(result.name).toBeNull();
  });
});

describe('the tag table itself stays closed', () => {
  it('a driver cannot read tags', async () => {
    // Check-in resolves a token server-side precisely so that scanning never
    // requires exposing the tag table (docs/NFC.md §6).
    const result = await asUser(USERS.driverA1, 'select id from nfc_tags');
    expect(result.rowCount).toBe(0);
  });

  it('a driver cannot read the scan-attempt log', async () => {
    const message = await expectDenied(USERS.driverA1, 'select * from tag_scan_attempts');
    expect(message).toMatch(/permission denied/i);
  });

  it("an owner cannot read another organisation's tags", async () => {
    const result = await asUser(USERS.ownerA, 'select id from nfc_tags where id = $1', [
      TAGS.klaasB,
    ]);
    expect(result.rowCount).toBe(0);
  });

  it('the token hash is never stored in plain text', async () => {
    const db = await adminConnect();
    const result = await db.query<{ length: number }>(
      'select octet_length(token_hash) as length from nfc_tags limit 1',
    );
    // A SHA-256 digest, not a token: 32 bytes exactly.
    expect(result.rows[0]?.length).toBe(32);
  });

  it('one client cannot hold two active tags', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      `insert into nfc_tags (organization_id, public_code, token_hash, client_id, status)
       values ($1, 'TP-TAXI-DUP001', digest('another', 'sha256'),
               '30000000-0000-4000-8000-00000000000a', 'ACTIVE')`,
      [ORGS.a],
    );
    expect(message).toMatch(/duplicate key|unique/i);
  });

  it('an active tag must point at a client', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      `insert into nfc_tags (organization_id, public_code, token_hash, status)
       values ($1, 'TP-TAXI-NOCL01', digest('x', 'sha256'), 'ACTIVE')`,
      [ORGS.a],
    );
    expect(message).toMatch(/active_has_client/i);
  });
});

describe('rate limiting', () => {
  it('cuts off after twenty attempts in a minute', async () => {
    // Twenty is far above any real driver and far below what makes guessing a
    // 128-bit token worth attempting.
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: DRIVER_KEES, role: 'authenticated' }),
      ]);

      const outcomes: string[] = [];
      for (let i = 0; i < 22; i += 1) {
        const result = await db.query<{ outcome: string }>(
          `select outcome from public.checkin_by_tag_token(digest('probe-${i}', 'sha256'), 'NFC')`,
        );
        outcomes.push(result.rows[0]?.outcome ?? 'NONE');
      }

      expect(outcomes.slice(0, 20).every((o) => o === 'UNKNOWN_TAG')).toBe(true);
      expect(outcomes.at(-1)).toBe('RATE_LIMITED');
    } finally {
      await db.query('rollback');
    }
  });
});
