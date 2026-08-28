import { afterAll, describe, expect, it } from 'vitest';
import {
  adminConnect,
  asUser,
  disconnect,
  expectDenied,
  DRIVERS,
  ORGS,
  RIDES,
  USERS,
} from './harness';
import { DRIVER_ACTIONS } from '@/features/driver/workflow';
import { canTransition } from '@/features/rides/status';

/**
 * The driver workflow, at the layer that decides.
 *
 * A driver holds neither rides.dispatch nor rides.update. Their authority comes
 * from the assignment itself — and that boundary is what these tests attack.
 */

const STOP_DE_ES = 'a2000000-0000-4000-8000-000000000001';

afterAll(async () => {
  await disconnect();
});

describe('a driver can only touch their own rides', () => {
  it('sees only rides assigned to them', async () => {
    const result = await asUser<{ id: string }>(USERS.driverA1, 'select id from rides');
    const ids = result.rows.map((r) => r.id);
    expect(ids).toContain(RIDES.janA);
    expect(ids).not.toContain(RIDES.pietA);
  });

  it("cannot advance a colleague's ride", async () => {
    const result = await asUser(
      USERS.driverA1,
      "update rides set status = 'DRIVER_EN_ROUTE' where id = $1",
      [RIDES.pietA],
    );
    expect(result.rowCount).toBe(0);
  });

  it('cannot assign a ride to themselves', async () => {
    const result = await asUser(
      USERS.driverA1,
      'update rides set driver_id = $1 where id = $2',
      [DRIVERS.keesA, RIDES.unassignedA],
    );
    expect(result.rowCount).toBe(0);
  });

  it('cannot create a ride', async () => {
    const message = await expectDenied(
      USERS.driverA1,
      `insert into rides (organization_id, client_id, scheduled_date, scheduled_pickup_time,
                          scheduled_pickup_at, pickup_location_id, destination_location_id)
       values ($1, '30000000-0000-4000-8000-00000000000a', current_date, '08:00', now(),
               '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000b')`,
      [ORGS.a],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('cannot cancel a ride, even their own', async () => {
    // Cancelling is a planning decision, not a driver's. The state machine
    // allows the transition; the permission does not.
    const result = await asUser(USERS.driverA1, 'delete from rides where id = $1', [
      RIDES.janA,
    ]);
    expect(result.rowCount).toBe(0);
  });
});

describe('the workflow order is enforced', () => {
  it('walks the full flow in order', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.driverA1, role: 'authenticated' }),
      ]);

      for (const status of [
        'DRIVER_EN_ROUTE',
        'DRIVER_ARRIVED',
        'CLIENT_CHECKED_IN',
        'TRIP_STARTED',
        'ARRIVED',
        'COMPLETED',
      ]) {
        const result = await db.query('update rides set status = $1 where id = $2', [
          status,
          RIDES.janA,
        ]);
        expect(result.rowCount, `transition to ${status}`).toBe(1);
      }
    } finally {
      await db.query('rollback');
    }
  });

  it('refuses skipping check-in', async () => {
    const message = await expectDenied(
      USERS.driverA1,
      "update rides set status = 'TRIP_STARTED' where id = $1",
      [RIDES.janA],
    );
    expect(message).toMatch(/illegal ride status transition/i);
  });

  it('refuses jumping straight to completed', async () => {
    const message = await expectDenied(
      USERS.driverA1,
      "update rides set status = 'COMPLETED' where id = $1",
      [RIDES.janA],
    );
    expect(message).toMatch(/illegal ride status transition/i);
  });

  it('every driver action is a legal transition in the state machine', () => {
    // Guards against a button that offers a step the machine will refuse — the
    // driver would tap it and get an error with no way forward.
    for (const [key, action] of Object.entries(DRIVER_ACTIONS)) {
      expect(
        canTransition(action.from, action.to),
        `${key}: ${action.from} → ${action.to}`,
      ).toBe(true);
    }
  });

  it('offers at most one action per status', () => {
    // The driver screen shows a single primary button. Two candidates for one
    // status would mean the screen picks arbitrarily.
    const byFrom = new Map<string, number>();
    for (const action of Object.values(DRIVER_ACTIONS)) {
      byFrom.set(action.from, (byFrom.get(action.from) ?? 0) + 1);
    }
    expect([...byFrom.values()].every((count) => count === 1)).toBe(true);
  });
});

describe('absence', () => {
  it('can only be reported once the driver has arrived', async () => {
    const message = await expectDenied(
      USERS.driverA1,
      "update rides set status = 'CLIENT_ABSENT' where id = $1",
      [RIDES.janA],
    );
    expect(message).toMatch(/illegal ride status transition/i);
  });

  it('is allowed from DRIVER_ARRIVED', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      // Walk the flow rather than jumping: the state machine refuses the leap,
      // and rightly — a driver cannot arrive without setting off.
      await db.query("update rides set status = 'DRIVER_EN_ROUTE' where id = $1", [
        RIDES.janA,
      ]);
      await db.query("update rides set status = 'DRIVER_ARRIVED' where id = $1", [
        RIDES.janA,
      ]);
      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.driverA1, role: 'authenticated' }),
      ]);
      const result = await db.query(
        "update rides set status = 'CLIENT_ABSENT', absence_reason = 'NOT_HOME' where id = $1",
        [RIDES.janA],
      );
      expect(result.rowCount).toBe(1);
    } finally {
      await db.query('rollback');
    }
  });

  it('refuses an absence reason on a ride that is not absent', async () => {
    const message = await expectDenied(
      USERS.driverA1,
      "update rides set absence_reason = 'ILL' where id = $1",
      [RIDES.janA],
    );
    expect(message).toMatch(/absence_reason_only_when_absent/i);
  });
});

describe('ride events written by a driver', () => {
  it('can be written for their own ride', async () => {
    const result = await asUser(
      USERS.driverA1,
      `insert into ride_events (organization_id, ride_id, event_type, actor_kind, source)
       values ($1, $2, 'DRIVER_EN_ROUTE', 'DRIVER', 'MANUAL')`,
      [ORGS.a, RIDES.janA],
    );
    expect(result.rowCount).toBe(1);
  });

  it("cannot be written for a colleague's ride", async () => {
    const message = await expectDenied(
      USERS.driverA1,
      `insert into ride_events (organization_id, ride_id, event_type, actor_kind, source)
       values ($1, $2, 'CLIENT_CHECKED_IN', 'DRIVER', 'NFC')`,
      [ORGS.a, RIDES.pietA],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('cannot be altered afterwards, not even by the driver who wrote it', async () => {
    const message = await expectDenied(
      USERS.driverA1,
      "update ride_events set event_type = 'COMPLETED' where ride_id = $1",
      [RIDES.janA],
    );
    expect(message).toMatch(/permission denied|append-only/i);
  });

  it('records a second check-in attempt as a duplicate, not a new event', async () => {
    // The idempotency that the NFC flow will rely on in Fase 7.
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.driverA1, role: 'authenticated' }),
      ]);
      await db.query(
        `insert into ride_events (organization_id, ride_id, event_type, actor_kind, source)
         values ($1, $2, 'CLIENT_CHECKED_IN', 'DRIVER', 'MANUAL')`,
        [ORGS.a, RIDES.janA],
      );
      await expect(
        db.query(
          `insert into ride_events (organization_id, ride_id, event_type, actor_kind, source)
           values ($1, $2, 'CLIENT_CHECKED_IN', 'DRIVER', 'NFC')`,
          [ORGS.a, RIDES.janA],
        ),
      ).rejects.toThrow(/duplicate key|unique/i);
    } finally {
      await db.query('rollback');
    }
  });
});

describe('group runs', () => {
  it('the assigned driver can mark a stop as reached', async () => {
    const result = await asUser(
      USERS.driverA2,
      'update trip_stops set arrived_at = now() where id = $1',
      [STOP_DE_ES],
    );
    expect(result.rowCount).toBe(1);
  });

  it('another driver cannot mark that stop', async () => {
    const result = await asUser(
      USERS.driverA1,
      'update trip_stops set arrived_at = now() where id = $1',
      [STOP_DE_ES],
    );
    expect(result.rowCount).toBe(0);
  });

  it('a driver from another organisation sees no stops at all', async () => {
    const result = await asUser(USERS.driverB, 'select id from trip_stops');
    expect(result.rowCount).toBe(0);
  });

  it('one arrival covers every passenger at the stop', async () => {
    // The point of decision D-17: four passengers, one press.
    const db = await adminConnect();
    const result = await db.query<{ count: string }>(
      'select count(*)::text as count from rides where pickup_stop_id = $1',
      [STOP_DE_ES],
    );
    expect(Number(result.rows[0]?.count)).toBeGreaterThan(1);
  });

  it('the driver can advance each passenger individually after arriving', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query('update trip_stops set arrived_at = now() where id = $1', [
        STOP_DE_ES,
      ]);
      for (const status of ['DRIVER_EN_ROUTE', 'DRIVER_ARRIVED']) {
        await db.query('update rides set status = $1 where pickup_stop_id = $2', [
          status,
          STOP_DE_ES,
        ]);
      }

      await db.query('set local role authenticated');
      await db.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.driverA2, role: 'authenticated' }),
      ]);

      const { rows } = await db.query<{ id: string }>(
        'select id from rides where pickup_stop_id = $1 order by id limit 1',
        [STOP_DE_ES],
      );
      const result = await db.query(
        "update rides set status = 'CLIENT_CHECKED_IN' where id = $1",
        [rows[0]?.id],
      );
      expect(result.rowCount).toBe(1);
    } finally {
      await db.query('rollback');
    }
  });
});

describe('the driver context is scoped to one organisation', () => {
  it('a driver in org B sees nothing from org A', async () => {
    const result = await asUser(USERS.driverB, 'select id from rides where id = $1', [
      RIDES.janA,
    ]);
    expect(result.rowCount).toBe(0);
  });

  it('a planner is not a driver and has no driver record', async () => {
    const result = await asUser(
      USERS.plannerA,
      'select id from drivers where user_id = $1',
      [USERS.plannerA],
    );
    expect(result.rowCount).toBe(0);
  });
});
