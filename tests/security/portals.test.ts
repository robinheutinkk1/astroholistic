import { afterAll, describe, expect, it } from 'vitest';
import {
  adminConnect,
  asUser,
  CLIENTS,
  disconnect,
  expectDenied,
  ORGS,
  RIDES,
  USERS,
} from './harness';

/**
 * The client, contact and care-organisation portals.
 *
 * These users are the least technical and the most numerous, and they reach the
 * system from their own phones. Every boundary here is one a parent could cross
 * by editing a URL.
 */

afterAll(async () => {
  await disconnect();
});

describe('a parent sees only their own child', () => {
  it('sees the linked client', async () => {
    const result = await asUser<{ id: string }>(USERS.parentA, 'select id from clients');
    expect(result.rows.map((r) => r.id)).toEqual([CLIENTS.janA]);
  });

  it('cannot read another client in the same organisation', async () => {
    // Masterprompt §54, verbatim: Parent A tries to view Client B → DENIED.
    const result = await asUser(USERS.parentA, 'select id from clients where id = $1', [
      CLIENTS.pietA,
    ]);
    expect(result.rowCount).toBe(0);
  });

  it("cannot read another client's rides", async () => {
    const result = await asUser(USERS.parentA, 'select id from rides where id = $1', [
      RIDES.pietA,
    ]);
    expect(result.rowCount).toBe(0);
  });

  it('sees every ride of their own child, including group trips', async () => {
    // The portal follows the client, so both the morning and the afternoon trip
    // appear — unlike a driver, who follows the assignment.
    const result = await asUser<{ count: number }>(
      USERS.parentA,
      'select count(*)::int as count from rides where client_id = $1',
      [CLIENTS.janA],
    );
    expect(result.rows[0]?.count).toBeGreaterThan(1);
  });

  it('loses access the moment the link is switched off', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query(
        'update client_contacts set can_view_rides = false where client_id = $1',
        [CLIENTS.janA],
      );
      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.parentA, role: 'authenticated' }),
      ]);
      const result = await db.query<{ count: number }>(
        'select count(*)::int as count from clients',
      );
      expect(result.rows[0]?.count).toBe(0);
    } finally {
      await db.query('rollback');
    }
  });
});

describe('portals never write to rides', () => {
  it('a parent cannot change a ride status', async () => {
    // Decision D-08. Blocked here by RLS, not merely hidden in the interface.
    const result = await asUser(
      USERS.parentA,
      "update rides set status = 'CANCELLED' where id = $1",
      [RIDES.janA],
    );
    expect(result.rowCount).toBe(0);
  });

  it('a client cannot change their own ride', async () => {
    const result = await asUser(
      USERS.clientA,
      "update rides set scheduled_pickup_time = '10:00' where id = $1",
      [RIDES.janA],
    );
    expect(result.rowCount).toBe(0);
  });

  it('a care organisation cannot change a ride', async () => {
    const result = await asUser(
      USERS.careA,
      "update rides set status = 'CANCELLED' where id = $1",
      [RIDES.janA],
    );
    expect(result.rowCount).toBe(0);
  });

  it('a parent cannot create a ride either', async () => {
    const message = await expectDenied(
      USERS.parentA,
      `insert into rides (organization_id, client_id, scheduled_date, scheduled_pickup_time,
                          scheduled_pickup_at, pickup_location_id, destination_location_id)
       values ($1, $2, current_date, '08:00', now(),
               '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000b')`,
      [ORGS.a, CLIENTS.janA],
    );
    expect(message).toMatch(/row-level security/i);
  });
});

describe('change requests', () => {
  it('a parent can file one for their own child', async () => {
    const result = await asUser(
      USERS.parentA,
      `insert into change_requests (organization_id, client_id, ride_id,
                                    requested_by_user_id, requester_kind, kind)
       values ($1, $2, $3, $4, 'CONTACT', 'ABSENCE') returning id`,
      [ORGS.a, CLIENTS.janA, RIDES.janA, USERS.parentA],
    );
    expect(result.rowCount).toBe(1);
  });

  it('cannot file one for a client they cannot see', async () => {
    const message = await expectDenied(
      USERS.parentA,
      `insert into change_requests (organization_id, client_id, requested_by_user_id,
                                    requester_kind, kind)
       values ($1, $2, $3, 'CONTACT', 'CANCEL')`,
      [ORGS.a, CLIENTS.pietA, USERS.parentA],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it("cannot file one in someone else's name", async () => {
    const message = await expectDenied(
      USERS.parentA,
      `insert into change_requests (organization_id, client_id, requested_by_user_id,
                                    requester_kind, kind)
       values ($1, $2, $3, 'CONTACT', 'CANCEL')`,
      [ORGS.a, CLIENTS.janA, USERS.plannerA],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('a parent cannot approve their own request', async () => {
    // Reviewing needs change_requests.review, which no portal user holds.
    const db = await adminConnect();
    await db.query('begin');
    try {
      const { rows } = await db.query<{ id: string }>(
        `insert into change_requests (organization_id, client_id, requested_by_user_id,
                                      requester_kind, kind)
         values ($1, $2, $3, 'CONTACT', 'ABSENCE') returning id`,
        [ORGS.a, CLIENTS.janA, USERS.parentA],
      );

      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.parentA, role: 'authenticated' }),
      ]);

      const result = await db.query(
        "update change_requests set status = 'APPROVED' where id = $1",
        [rows[0]?.id],
      );
      expect(result.rowCount).toBe(0);
    } finally {
      await db.query('rollback');
    }
  });

  it('a planner can review one', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      const { rows } = await db.query<{ id: string }>(
        `insert into change_requests (organization_id, client_id, requested_by_user_id,
                                      requester_kind, kind)
         values ($1, $2, $3, 'CONTACT', 'ABSENCE') returning id`,
        [ORGS.a, CLIENTS.janA, USERS.parentA],
      );

      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.plannerA, role: 'authenticated' }),
      ]);

      const result = await db.query(
        `update change_requests set status = 'APPROVED', reviewed_by = $1, reviewed_at = now()
         where id = $2`,
        [USERS.plannerA, rows[0]?.id],
      );
      expect(result.rowCount).toBe(1);
    } finally {
      await db.query('rollback');
    }
  });

  it("org B cannot see org A's requests", async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query(
        `insert into change_requests (organization_id, client_id, requested_by_user_id,
                                      requester_kind, kind)
         values ($1, $2, $3, 'CONTACT', 'ABSENCE')`,
        [ORGS.a, CLIENTS.janA, USERS.parentA],
      );

      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.ownerB, role: 'authenticated' }),
      ]);

      const result = await db.query('select id from change_requests');
      expect(result.rowCount).toBe(0);
    } finally {
      await db.query('rollback');
    }
  });
});

describe('a care organisation follows only what it funds', () => {
  it('sees the client it funds', async () => {
    const result = await asUser<{ id: string }>(USERS.careA, 'select id from clients');
    expect(result.rows.map((r) => r.id)).toEqual([CLIENTS.janA]);
  });

  it('cannot see a client it does not fund', async () => {
    const result = await asUser(USERS.careA, 'select id from clients where id = $1', [
      CLIENTS.pietA,
    ]);
    expect(result.rowCount).toBe(0);
  });

  it('loses access when the funding arrangement ends', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query(
        'update client_care_organizations set valid_to = current_date - 1 where client_id = $1',
        [CLIENTS.janA],
      );
      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.careA, role: 'authenticated' }),
      ]);
      const result = await db.query<{ count: number }>(
        'select count(*)::int as count from clients',
      );
      expect(result.rows[0]?.count).toBe(0);
    } finally {
      await db.query('rollback');
    }
  });

  it('cannot read the audit log or tags', async () => {
    expect((await asUser(USERS.careA, 'select id from audit_logs')).rowCount).toBe(0);
    expect((await asUser(USERS.careA, 'select id from nfc_tags')).rowCount).toBe(0);
  });
});

describe('a client sees only themselves', () => {
  it('reads their own record and no other', async () => {
    const result = await asUser<{ id: string }>(USERS.clientA, 'select id from clients');
    expect(result.rows.map((r) => r.id)).toEqual([CLIENTS.janA]);
  });

  it('cannot read the driver list', async () => {
    expect((await asUser(USERS.clientA, 'select id from drivers')).rowCount).toBe(0);
  });

  it('cannot read other contacts', async () => {
    expect((await asUser(USERS.clientA, 'select id from contacts')).rowCount).toBe(0);
  });
});
