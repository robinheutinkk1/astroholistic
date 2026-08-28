import { afterAll, describe, expect, it } from 'vitest';
import { adminConnect, asUser, disconnect, expectDenied, ORGS, USERS } from './harness';

/**
 * Group transport: several clients collected at one location.
 *
 * This is the primary use case for the platform, so the constraints protecting
 * it are tested as seriously as the tenant boundary. A capacity check that
 * silently does nothing means a bus turns up with too few seats — with a
 * vulnerable passenger left standing at a day care.
 */

const TRIP = 'a1000000-0000-4000-8000-00000000000a';
const STOP_DE_ES = 'a2000000-0000-4000-8000-000000000001';
const STOP_JANSEN = 'a2000000-0000-4000-8000-000000000002';
const STOP_WERKPLAATS = 'a2000000-0000-4000-8000-000000000004';
const CLIENT_SPARE = '30000000-0000-4000-8000-00000000000b';
const DRIVER_SANNE = '50000000-0000-4000-8000-00000000000b';
const DRIVER_KEES = '50000000-0000-4000-8000-00000000000a';
const VEHICLE_FORD = '60000000-0000-4000-8000-00000000000b';
const LOC_DE_ES = '10000000-0000-4000-8000-00000000000b';
const LOC_JANSEN = '10000000-0000-4000-8000-00000000000a';
const LOC_WERKPLAATS = '10000000-0000-4000-8000-00000000000d';

afterAll(async () => {
  await disconnect();
});

/** Captured when this file is loaded, before any test has run. */
const SUITE_START = new Date().toISOString();

describe('the suite leaves no residue', () => {
  it('has created no rides of its own', async () => {
    // A suite that only passes on a freshly seeded database is unreliable: the
    // second CI run fails for reasons unrelated to the change under review.
    // This assertion catches a test that commits instead of rolling back.
    //
    // Stated as "nothing created since the suite started" rather than as a
    // fixed total. A hardcoded count answers the same question but breaks every
    // time the seed grows a row, which sends the reader looking for a leak that
    // is not there.
    const db = await adminConnect();
    const result = await db.query<{ count: string }>(
      'select count(*)::text as count from rides where created_at > $1',
      [SUITE_START],
    );
    expect(result.rows[0]?.count).toBe('0');
  });
});

describe('the journey is one thing, not four', () => {
  it('groups the four passengers under a single trip', async () => {
    const db = await adminConnect();
    const result = await db.query<{ count: string }>(
      'select count(*)::text as count from rides where trip_id = $1',
      [TRIP],
    );
    expect(result.rows[0]?.count).toBe('4');
  });

  it('has one pickup stop that all four board at', async () => {
    const db = await adminConnect();
    const result = await db.query<{ count: string }>(
      'select count(*)::text as count from rides where pickup_stop_id = $1',
      [STOP_DE_ES],
    );
    // The whole point: the driver presses "arrived" once here, not four times.
    expect(result.rows[0]?.count).toBe('4');
  });

  it('reports peak occupancy rather than total passengers carried', async () => {
    const db = await adminConnect();
    const result = await db.query<{ passengers: number; wheelchairs: number }>(
      'select * from app.trip_peak_occupancy($1)',
      [TRIP],
    );
    // Four aboard at once. A naive "count the rides" would agree here, but
    // would wrongly reject a run where passengers alight before others board.
    expect(result.rows[0]?.passengers).toBe(4);
  });
});

describe('capacity is enforced', () => {
  it('refuses a passenger beyond the vehicle seat count', async () => {
    // The Ford has six seats and already carries four. Adding three more of the
    // same leg must fail at commit.
    const db = await adminConnect();
    await db.query('begin');
    try {
      for (let i = 0; i < 3; i += 1) {
        await db.query(
          `insert into rides (organization_id, client_id, scheduled_date, scheduled_pickup_time,
                              scheduled_pickup_at, pickup_location_id, destination_location_id,
                              driver_id, vehicle_id, status, trip_id, pickup_stop_id, dropoff_stop_id)
           values ($1, $2, current_date, '16:00', now(), $3, $4, $5, $6,
                   'DRIVER_ASSIGNED', $7, $8, $9)`,
          [
            ORGS.a,
            CLIENT_SPARE,
            LOC_DE_ES,
            LOC_JANSEN,
            DRIVER_SANNE,
            VEHICLE_FORD,
            TRIP,
            STOP_DE_ES,
            STOP_WERKPLAATS,
          ],
        );
      }
      await expect(db.query('set constraints all immediate')).rejects.toThrow(
        /exceeds vehicle capacity/i,
      );
    } finally {
      await db.query('rollback');
    }
  });

  it('allows a passenger who boards after another has alighted', async () => {
    // Occupancy, not headcount: someone boarding at stop 2 and alighting at
    // stop 4 never shares the bus with the passenger who left at stop 2.
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query(
        `insert into rides (organization_id, client_id, scheduled_date, scheduled_pickup_time,
                            scheduled_pickup_at, pickup_location_id, destination_location_id,
                            driver_id, vehicle_id, status, trip_id, pickup_stop_id, dropoff_stop_id)
         values ($1, $2, current_date, '16:25', now(), $3, $4, $5, $6,
                 'DRIVER_ASSIGNED', $7, $8, $9)`,
        [
          ORGS.a,
          CLIENT_SPARE,
          LOC_JANSEN,
          LOC_WERKPLAATS,
          DRIVER_SANNE,
          VEHICLE_FORD,
          TRIP,
          STOP_JANSEN,
          STOP_WERKPLAATS,
        ],
      );
      await expect(db.query('set constraints all immediate')).resolves.toBeDefined();
    } finally {
      await db.query('rollback');
    }
  });

  it('refuses a wheelchair passenger when the vehicle has no wheelchair position', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query(
        `insert into rides (organization_id, client_id, scheduled_date, scheduled_pickup_time,
                            scheduled_pickup_at, pickup_location_id, destination_location_id,
                            driver_id, vehicle_id, status, trip_id, pickup_stop_id, dropoff_stop_id,
                            transport_requirements)
         values ($1, $2, current_date, '16:00', now(), $3, $4, $5, $6,
                 'DRIVER_ASSIGNED', $7, $8, $9, array['WHEELCHAIR']::transport_requirement[])`,
        [
          ORGS.a,
          CLIENT_SPARE,
          LOC_DE_ES,
          LOC_JANSEN,
          DRIVER_SANNE,
          VEHICLE_FORD,
          TRIP,
          STOP_DE_ES,
          STOP_JANSEN,
        ],
      );
      await expect(db.query('set constraints all immediate')).rejects.toThrow(
        /wheelchair capacity/i,
      );
    } finally {
      await db.query('rollback');
    }
  });
});

describe('a driver and a vehicle cannot be in two places at once', () => {
  it('refuses a second overlapping trip for the same driver', async () => {
    const message = await expectDenied(
      USERS.plannerA,
      `insert into trips (organization_id, name, scheduled_date, driver_id, vehicle_id,
                          status, planned_start_time, planned_start_at, planned_end_at)
       values ($1, 'Botsende rit', current_date, $2, null, 'ASSIGNED', '16:30',
               (current_date + time '16:30') at time zone 'Europe/Amsterdam',
               (current_date + time '17:30') at time zone 'Europe/Amsterdam')`,
      [ORGS.a, DRIVER_SANNE],
    );
    expect(message).toMatch(/trips_driver_no_overlap|conflicting key/i);
  });

  it('refuses a second overlapping trip for the same vehicle', async () => {
    const message = await expectDenied(
      USERS.plannerA,
      `insert into trips (organization_id, name, scheduled_date, driver_id, vehicle_id,
                          status, planned_start_time, planned_start_at, planned_end_at)
       values ($1, 'Botsende bus', current_date, $2, $3, 'ASSIGNED', '16:30',
               (current_date + time '16:30') at time zone 'Europe/Amsterdam',
               (current_date + time '17:30') at time zone 'Europe/Amsterdam')`,
      [ORGS.a, DRIVER_KEES, VEHICLE_FORD],
    );
    expect(message).toMatch(/trips_vehicle_no_overlap|conflicting key/i);
  });

  it('allows a non-overlapping trip for the same driver', async () => {
    const result = await asUser(
      USERS.plannerA,
      `insert into trips (organization_id, name, scheduled_date, driver_id,
                          status, planned_start_time, planned_start_at, planned_end_at)
       values ($1, 'Avondrit', current_date, $2, 'ASSIGNED', '18:00',
               (current_date + time '18:00') at time zone 'Europe/Amsterdam',
               (current_date + time '19:00') at time zone 'Europe/Amsterdam')
       returning id`,
      [ORGS.a, DRIVER_SANNE],
    );
    expect(result.rowCount).toBe(1);
  });

  it('ignores cancelled trips when checking for overlap', async () => {
    // A cancelled run must not block the replacement that covers it.
    const db = await adminConnect();
    await db.query('begin');
    try {
      await db.query("update trips set status = 'CANCELLED' where id = $1", [TRIP]);
      const result = await db.query(
        `insert into trips (organization_id, name, scheduled_date, driver_id, vehicle_id,
                            status, planned_start_time, planned_start_at, planned_end_at)
         values ($1, 'Vervangende rit', current_date, $2, $3, 'ASSIGNED', '16:00',
                 (current_date + time '16:00') at time zone 'Europe/Amsterdam',
                 (current_date + time '17:15') at time zone 'Europe/Amsterdam')
         returning id`,
        [ORGS.a, DRIVER_SANNE, VEHICLE_FORD],
      );
      expect(result.rowCount).toBe(1);
    } finally {
      await db.query('rollback');
    }
  });
});

describe('trip integrity', () => {
  it('refuses a stop that belongs to another trip', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      const other = await db.query<{ id: string }>(
        `insert into trips (organization_id, name, scheduled_date, status,
                            planned_start_time, planned_start_at, planned_end_at)
         values ($1, 'Andere rit', current_date, 'PLANNED', '20:00',
                 (current_date + time '20:00') at time zone 'Europe/Amsterdam',
                 (current_date + time '21:00') at time zone 'Europe/Amsterdam')
         returning id`,
        [ORGS.a],
      );
      await expect(
        db.query('update rides set trip_id = $1 where pickup_stop_id = $2', [
          other.rows[0]?.id,
          STOP_DE_ES,
        ]),
      ).rejects.toThrow(/does not belong to this trip/i);
    } finally {
      await db.query('rollback');
    }
  });

  it('refuses a passenger alighting before they board', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await expect(
        db.query(
          `update rides set pickup_stop_id = $1, dropoff_stop_id = $2
           where trip_id = $3 and pickup_stop_id = $4`,
          [STOP_WERKPLAATS, STOP_DE_ES, TRIP, STOP_DE_ES],
        ),
      ).rejects.toThrow(/must board before alighting/i);
    } finally {
      await db.query('rollback');
    }
  });

  it('refuses a trip and ride belonging to different organisations', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await expect(
        db.query(
          'update rides set trip_id = $1 where organization_id = $2 and trip_id is null',
          [TRIP, ORGS.b],
        ),
      ).rejects.toThrow(/different organisations/i);
    } finally {
      await db.query('rollback');
    }
  });
});

describe('tenant isolation extends to trips', () => {
  it("org B cannot read org A's trip", async () => {
    const result = await asUser(USERS.ownerB, 'select id from trips where id = $1', [
      TRIP,
    ]);
    expect(result.rowCount).toBe(0);
  });

  it('a driver sees only the trips assigned to them', async () => {
    // Sanne drives this run; Kees does not.
    const sanne = await asUser<{ id: string }>(USERS.driverA2, 'select id from trips');
    const kees = await asUser<{ id: string }>(USERS.driverA1, 'select id from trips');
    expect(sanne.rows.map((r) => r.id)).toContain(TRIP);
    expect(kees.rows.map((r) => r.id)).not.toContain(TRIP);
  });

  it('a driver can mark the whole stop as arrived, in one action', async () => {
    const result = await asUser(
      USERS.driverA2,
      'update trip_stops set arrived_at = now() where id = $1',
      [STOP_DE_ES],
    );
    expect(result.rowCount).toBe(1);
  });

  it("a driver cannot mark another driver's stop as arrived", async () => {
    const result = await asUser(
      USERS.driverA1,
      'update trip_stops set arrived_at = now() where id = $1',
      [STOP_DE_ES],
    );
    expect(result.rowCount).toBe(0);
  });
});
