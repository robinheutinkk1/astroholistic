import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { adminConnect, asUser, disconnect, expectDenied, ORGS, USERS } from './harness';
import { computeOccurrences } from '@/features/ride-templates/occurrences';

/**
 * Ride generation from recurring templates, against the real database.
 *
 * The pure occurrence maths is unit-tested separately. What these tests cover
 * is what only the database can guarantee: that running the job twice does not
 * double the rides, and that an exception survives the next run.
 */

const TEMPLATE_HEEN = '70000000-0000-4000-8000-00000000000a';

afterAll(async () => {
  await disconnect();
});

/** Mirrors the generation service, so the assertions test the real insert. */
async function generate(
  client: Awaited<ReturnType<typeof adminConnect>>,
  organizationId: string,
  horizonDays = 14,
): Promise<number> {
  const { rows: templates } = await client.query<{
    id: string;
    client_id: string;
    pickup_location_id: string;
    destination_location_id: string;
    departure_time: string;
    days_of_week: number[];
    starts_on: string;
    ends_on: string | null;
    default_driver_id: string | null;
    default_vehicle_id: string | null;
    transport_requirements: string[];
  }>(
    `select id, client_id, pickup_location_id, destination_location_id,
            departure_time, days_of_week, starts_on, ends_on,
            default_driver_id, default_vehicle_id, transport_requirements
     from ride_templates
     where organization_id = $1 and status = 'ACTIVE'`,
    [organizationId],
  );

  const today = new Date();
  const windowStart = today.toISOString().slice(0, 10);
  const windowEnd = new Date(today.getTime() + horizonDays * 86_400_000)
    .toISOString()
    .slice(0, 10);

  let created = 0;
  for (const template of templates) {
    const dates = computeOccurrences(
      {
        daysOfWeek: template.days_of_week,
        startsOn: template.starts_on,
        endsOn: template.ends_on,
      },
      windowStart,
      windowEnd,
    );
    for (const date of dates) {
      const result = await client.query(
        `insert into rides (organization_id, client_id, ride_template_id, scheduled_date,
                            scheduled_pickup_time, scheduled_pickup_at,
                            pickup_location_id, destination_location_id,
                            driver_id, vehicle_id, status, source, transport_requirements)
         values ($1, $2, $3, $4, $5,
                 ($4::date + $5::time) at time zone 'Europe/Amsterdam',
                 $6, $7, $8, $9,
                 case when $8::uuid is null then 'SCHEDULED'::ride_status
                      else 'DRIVER_ASSIGNED'::ride_status end,
                 'TEMPLATE', $10)
         on conflict (ride_template_id, scheduled_date) do nothing`,
        [
          organizationId,
          template.client_id,
          template.id,
          date,
          template.departure_time,
          template.pickup_location_id,
          template.destination_location_id,
          template.default_driver_id,
          template.default_vehicle_id,
          template.transport_requirements,
        ],
      );
      created += result.rowCount ?? 0;
    }
  }
  return created;
}

describe('generation is idempotent', () => {
  let db: Awaited<ReturnType<typeof adminConnect>>;

  beforeEach(async () => {
    db = await adminConnect();
  });

  it('creates rides on the first run and none on the second', async () => {
    await db.query('begin');
    try {
      const first = await generate(db, ORGS.a);
      expect(first).toBeGreaterThan(0);

      // Running the job twice is normal: nightly cron plus a manual trigger.
      // The partial unique index is what makes the second run a no-op.
      const second = await generate(db, ORGS.a);
      expect(second).toBe(0);
    } finally {
      await db.query('rollback');
    }
  });

  it('refuses a duplicate ride for the same template and date outright', async () => {
    await db.query('begin');
    try {
      await generate(db, ORGS.a);
      const { rows } = await db.query<{ scheduled_date: string }>(
        `select scheduled_date from rides
         where ride_template_id = $1 order by scheduled_date limit 1`,
        [TEMPLATE_HEEN],
      );
      const date = rows[0]?.scheduled_date;
      expect(date).toBeDefined();

      await expect(
        db.query(
          `insert into rides (organization_id, client_id, ride_template_id, scheduled_date,
                              scheduled_pickup_time, scheduled_pickup_at,
                              pickup_location_id, destination_location_id, status, source)
           select organization_id, client_id, ride_template_id, scheduled_date,
                  scheduled_pickup_time, scheduled_pickup_at,
                  pickup_location_id, destination_location_id, 'SCHEDULED', 'TEMPLATE'
           from rides where ride_template_id = $1 and scheduled_date = $2`,
          [TEMPLATE_HEEN, date],
        ),
      ).rejects.toThrow(/duplicate key|unique/i);
    } finally {
      await db.query('rollback');
    }
  });

  it('allows two manual rides for the same client on the same day', async () => {
    // The uniqueness is per template, not per client: a morning and an
    // afternoon trip are two legitimate rides.
    await db.query('begin');
    try {
      const result = await db.query(
        `insert into rides (organization_id, client_id, scheduled_date, scheduled_pickup_time,
                            scheduled_pickup_at, pickup_location_id, destination_location_id,
                            status, source)
         select organization_id, client_id, scheduled_date, '19:00',
                now(), pickup_location_id, destination_location_id, 'SCHEDULED', 'MANUAL'
         from rides where ride_template_id = $1 limit 1`,
        [TEMPLATE_HEEN],
      );
      expect(result.rowCount).toBe(1);
    } finally {
      await db.query('rollback');
    }
  });
});

describe('exceptions survive regeneration', () => {
  it('leaves a manually modified ride untouched', async () => {
    // The literal requirement from masterprompt §15: changing one occurrence
    // must not be undone by the next nightly run.
    const db = await adminConnect();
    await db.query('begin');
    try {
      await generate(db, ORGS.a);

      const { rows } = await db.query<{ id: string }>(
        `select id from rides where ride_template_id = $1
         order by scheduled_date limit 1`,
        [TEMPLATE_HEEN],
      );
      const rideId = rows[0]?.id;

      await db.query(
        `update rides set scheduled_pickup_time = '08:30', is_modified = true
         where id = $1`,
        [rideId],
      );

      await generate(db, ORGS.a);

      const { rows: after } = await db.query<{
        scheduled_pickup_time: string;
        is_modified: boolean;
      }>('select scheduled_pickup_time, is_modified from rides where id = $1', [rideId]);

      expect(after[0]?.scheduled_pickup_time).toBe('08:30:00');
      expect(after[0]?.is_modified).toBe(true);
    } finally {
      await db.query('rollback');
    }
  });

  it('does not regenerate a ride that was cancelled', async () => {
    // A cancelled occurrence must stay cancelled; regenerating it would put a
    // bus on the road for a client who cancelled.
    const db = await adminConnect();
    await db.query('begin');
    try {
      await generate(db, ORGS.a);

      const { rows } = await db.query<{ id: string }>(
        `select id from rides where ride_template_id = $1
         order by scheduled_date limit 1`,
        [TEMPLATE_HEEN],
      );
      const rideId = rows[0]?.id;
      await db.query("update rides set status = 'CANCELLED' where id = $1", [rideId]);

      await generate(db, ORGS.a);

      const { rows: after } = await db.query<{ status: string; count: string }>(
        `select status, (select count(*)::text from rides r2
                         where r2.ride_template_id = $1
                           and r2.scheduled_date = r.scheduled_date) as count
         from rides r where id = $2`,
        [TEMPLATE_HEEN, rideId],
      );
      expect(after[0]?.status).toBe('CANCELLED');
      expect(after[0]?.count).toBe('1');
    } finally {
      await db.query('rollback');
    }
  });
});

describe('generated rides inherit from the template', () => {
  it('carries the transport requirement across (decision D-03a)', async () => {
    // Without inheritance a planner would tick "wheelchair" on 500 rides a
    // year, and the day they forget, the wrong bus turns up.
    const db = await adminConnect();
    await db.query('begin');
    try {
      await generate(db, ORGS.a);
      const { rows } = await db.query<{ transport_requirements: string[] }>(
        `select transport_requirements from rides
         where ride_template_id = $1 limit 1`,
        [TEMPLATE_HEEN],
      );
      expect(rows[0]?.transport_requirements).toContain('WHEELCHAIR');
    } finally {
      await db.query('rollback');
    }
  });

  it('assigns the default driver and sets the status accordingly', async () => {
    const db = await adminConnect();
    await db.query('begin');
    try {
      await generate(db, ORGS.a);
      const { rows } = await db.query<{ driver_id: string | null; status: string }>(
        `select driver_id, status from rides where ride_template_id = $1 limit 1`,
        [TEMPLATE_HEEN],
      );
      expect(rows[0]?.driver_id).not.toBeNull();
      expect(rows[0]?.status).toBe('DRIVER_ASSIGNED');
    } finally {
      await db.query('rollback');
    }
  });

  it('stores the pickup time as local wall-clock time', async () => {
    // Decision D-07: 08:00 stays 08:00 on the clock, whatever the season.
    const db = await adminConnect();
    await db.query('begin');
    try {
      await generate(db, ORGS.a);
      const { rows } = await db.query<{ time: string; local: string }>(
        `select scheduled_pickup_time::text as time,
                to_char(scheduled_pickup_at at time zone 'Europe/Amsterdam', 'HH24:MI') as local
         from rides where ride_template_id = $1 limit 1`,
        [TEMPLATE_HEEN],
      );
      expect(rows[0]?.time).toBe('08:00:00');
      expect(rows[0]?.local).toBe('08:00');
    } finally {
      await db.query('rollback');
    }
  });
});

describe('templates stay inside the tenant', () => {
  it("org B cannot read org A's templates", async () => {
    const result = await asUser(USERS.ownerB, 'select id from ride_templates');
    expect(result.rowCount).toBe(0);
  });

  it('a planner can create a template', async () => {
    const result = await asUser(
      USERS.plannerA,
      `insert into ride_templates (organization_id, client_id, pickup_location_id,
                                   destination_location_id, departure_time, days_of_week,
                                   starts_on)
       values ($1, '30000000-0000-4000-8000-00000000000b',
               '10000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-00000000000d',
               '09:00', array[1,3,5]::smallint[], current_date) returning id`,
      [ORGS.a],
    );
    expect(result.rowCount).toBe(1);
  });

  it('a dispatcher cannot create a template', async () => {
    const message = await expectDenied(
      USERS.dispatcherA,
      `insert into ride_templates (organization_id, client_id, pickup_location_id,
                                   destination_location_id, departure_time, days_of_week,
                                   starts_on)
       values ($1, '30000000-0000-4000-8000-00000000000b',
               '10000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-00000000000d',
               '09:00', array[1]::smallint[], current_date)`,
      [ORGS.a],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('refuses a template with no weekdays', async () => {
    const message = await expectDenied(
      USERS.plannerA,
      `insert into ride_templates (organization_id, client_id, pickup_location_id,
                                   destination_location_id, departure_time, days_of_week,
                                   starts_on)
       values ($1, '30000000-0000-4000-8000-00000000000b',
               '10000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-00000000000d',
               '09:00', array[]::smallint[], current_date)`,
      [ORGS.a],
    );
    expect(message).toMatch(/days_not_empty/i);
  });

  it('refuses a weekday outside 1..7', async () => {
    const message = await expectDenied(
      USERS.plannerA,
      `insert into ride_templates (organization_id, client_id, pickup_location_id,
                                   destination_location_id, departure_time, days_of_week,
                                   starts_on)
       values ($1, '30000000-0000-4000-8000-00000000000b',
               '10000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-00000000000d',
               '09:00', array[0,8]::smallint[], current_date)`,
      [ORGS.a],
    );
    expect(message).toMatch(/days_valid/i);
  });

  it('refuses identical pickup and destination', async () => {
    const message = await expectDenied(
      USERS.plannerA,
      `insert into ride_templates (organization_id, client_id, pickup_location_id,
                                   destination_location_id, departure_time, days_of_week,
                                   starts_on)
       values ($1, '30000000-0000-4000-8000-00000000000b',
               '10000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-00000000000c',
               '09:00', array[1]::smallint[], current_date)`,
      [ORGS.a],
    );
    expect(message).toMatch(/distinct_locations/i);
  });
});
