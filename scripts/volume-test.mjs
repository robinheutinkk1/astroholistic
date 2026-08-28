#!/usr/bin/env node
/**
 * Volume and query-plan check (Fase 13).
 *
 * Fills a database with a realistic load — 100 organisations, 50,000 rides,
 * 500,000 ride events — and then runs the queries the product actually makes,
 * as a real signed-in user, with RLS on.
 *
 * WHY AS A USER AND NOT AS THE OWNER. Running EXPLAIN as `postgres` measures a
 * query this application never makes. Every policy in this schema adds a
 * subquery or an array membership test, and those are exactly what turns an
 * index scan into a sequential one. A performance test that bypasses RLS
 * measures the wrong program.
 *
 * DESTRUCTIVE. It rebuilds the database it points at. Never aim it at anything
 * you care about; the connection string is deliberately not read from
 * .env.local.
 */
import { execSync } from 'node:child_process';
import pg from 'pg';

const CONNECTION =
  process.env.PERF_DATABASE_URL ??
  'postgresql://postgres@localhost:5433/postgres?host=/tmp';
const AUTHENTICATOR =
  process.env.PERF_AUTHENTICATOR_URL ??
  'postgresql://authenticator@localhost:5433/postgres?host=/tmp';

const ORGANIZATIONS = Number(process.env.PERF_ORGS ?? 100);
const RIDES = Number(process.env.PERF_RIDES ?? 50_000);
const EVENTS = Number(process.env.PERF_EVENTS ?? 500_000);

/**
 * The share of rides that goes to a single organisation.
 *
 * An even spread gives every tenant 500 rides, and 500 rows is fast however you
 * query it — the measurement would prove nothing. Real SaaS load is skewed: one
 * customer is an order of magnitude bigger than the median, and it is that
 * customer who finds the missing index. A transport company with 40 clients
 * driving twice a day makes about 20,000 rides a year, so that is the tenant
 * worth measuring.
 */
const SKEW = Number(process.env.PERF_SKEW ?? 0.4);

/** Anything slower than this on a warm cache is worth a look, not a shrug. */
const SLOW_MS = 100;

const admin = new pg.Client({ connectionString: CONNECTION });
await admin.connect();

function log(message) {
  console.log(message);
}

async function seedVolume() {
  const concentrated = Math.round(RIDES * SKEW);
  const spread = RIDES - concentrated;
  log(
    `Generating ${ORGANIZATIONS} organisations, ${RIDES} rides ` +
      `(${concentrated} of them in one tenant), ${EVENTS} events…`,
  );
  const started = Date.now();

  // One statement per table rather than a loop in JavaScript: 500,000 round
  // trips would measure the network, not the database.
  await admin.query(
    `
    insert into organizations (slug, name, status, is_demo)
    select 'perf-' || g, 'Perf organisatie ' || g, 'ACTIVE', true
    from generate_series(1, $1) g
  `,
    [ORGANIZATIONS],
  );

  await admin.query(`
    insert into organization_settings (organization_id)
    select id from organizations where slug like 'perf-%'
  `);

  await admin.query(`
    insert into locations (organization_id, name, kind, city)
    select o.id, 'Locatie ' || g, 'OTHER', 'Testplaats'
    from organizations o, generate_series(1, 6) g
    where o.slug like 'perf-%'
  `);

  await admin.query(`
    insert into clients (organization_id, first_name, last_name, city)
    select o.id, 'Cliënt', 'Nummer ' || g, 'Testplaats'
    from organizations o, generate_series(1, 40) g
    where o.slug like 'perf-%'
  `);

  await admin.query(`
    insert into drivers (organization_id, first_name, last_name, status)
    select o.id, 'Chauffeur', 'Nummer ' || g, 'ACTIVE'
    from organizations o, generate_series(1, 8) g
    where o.slug like 'perf-%'
  `);

  // Rides are spread over two years and across every organisation, so the
  // date-range queries below have something to actually narrow down.
  await admin.query(
    `
    with pool as (
      select o.id as organization_id,
             (array_agg(distinct c.id))[1 + (random() * 39)::int] as client_id,
             (array_agg(distinct d.id))[1 + (random() * 7)::int] as driver_id,
             (array_agg(distinct l.id))[1] as pickup,
             (array_agg(distinct l.id))[2] as destination
      from organizations o
      join clients c on c.organization_id = o.id
      join drivers d on d.organization_id = o.id
      join locations l on l.organization_id = o.id
      where o.slug like 'perf-%'
      group by o.id
    )
    insert into rides (
      organization_id, client_id, scheduled_date, scheduled_pickup_time,
      scheduled_pickup_at, pickup_location_id, destination_location_id,
      driver_id, status, source, checked_in_at, checked_in_method, completed_at
    )
    select
      p.organization_id,
      p.client_id,
      d.day,
      '08:00'::time,
      (d.day + time '08:00') at time zone 'Europe/Amsterdam',
      p.pickup,
      p.destination,
      p.driver_id,
      'COMPLETED',
      'TEMPLATE',
      (d.day + time '08:03') at time zone 'Europe/Amsterdam',
      'NFC',
      (d.day + time '08:35') at time zone 'Europe/Amsterdam'
    from pool p
    cross join lateral (
      select (current_date - (random() * 730)::int) as day
      from generate_series(1, ceil($1::numeric / (select count(*) from pool))::int)
    ) d
    limit $1
  `,
    [spread],
  );

  // The skewed share, all in one organisation.
  await admin.query(
    `
    with big as (
      select o.id as organization_id,
             (array_agg(distinct c.id))[1 + (random() * 39)::int] as client_id,
             (array_agg(distinct d.id))[1 + (random() * 7)::int] as driver_id,
             (array_agg(distinct l.id))[1] as pickup,
             (array_agg(distinct l.id))[2] as destination
      from organizations o
      join clients c on c.organization_id = o.id
      join drivers d on d.organization_id = o.id
      join locations l on l.organization_id = o.id
      where o.slug = 'perf-1'
      group by o.id
    )
    insert into rides (
      organization_id, client_id, scheduled_date, scheduled_pickup_time,
      scheduled_pickup_at, pickup_location_id, destination_location_id,
      driver_id, status, source, checked_in_at, checked_in_method, completed_at
    )
    select
      b.organization_id, b.client_id, d.day, '08:00'::time,
      (d.day + time '08:00') at time zone 'Europe/Amsterdam',
      b.pickup, b.destination, b.driver_id, 'COMPLETED', 'TEMPLATE',
      (d.day + time '08:03') at time zone 'Europe/Amsterdam', 'NFC',
      (d.day + time '08:35') at time zone 'Europe/Amsterdam'
    from big b
    cross join lateral (
      select (current_date - (random() * 730)::int) as day
      from generate_series(1, $1)
    ) d
  `,
    [concentrated],
  );

  // Roughly ten events per ride, which is what a completed journey produces:
  // assigned, en route, arrived, checked in, started, arrived, completed and a
  // couple of notes. `occurred_at` falls back to the planned time, because a
  // ride that was never checked in has no check-in timestamp.
  const perRide = Math.max(1, Math.ceil(EVENTS / Math.max(1, RIDES)));
  // Rotating over the event types that are NOT covered by
  // `ride_events_once_per_ride`. Milestone events are unique per ride by
  // design — that index is what makes a double tag scan harmless (§60) — so a
  // volume fixture has to respect it rather than work around it.
  await admin.query(
    `
    insert into ride_events (organization_id, ride_id, event_type, actor_kind, source, occurred_at)
    select r.organization_id,
           r.id,
           (array['NOTE_ADDED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'PROBLEM_REPORTED',
                  'VEHICLE_ASSIGNED', 'DRIVER_ASSIGNED', 'RESCHEDULED'])[1 + (g % 7)]::ride_event_type,
           'DRIVER',
           'MANUAL',
           coalesce(r.checked_in_at, r.scheduled_pickup_at) + make_interval(mins => g)
    from rides r
    cross join generate_series(1, $2) g
    limit $1
  `,
    [EVENTS, perRide],
  );

  await admin.query('analyze');
  log(`  done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

/**
 * Makes the seeded planner an owner of the busiest generated organisation.
 *
 * Without this every measurement below runs against the demo organisation's
 * few dozen rides, which proves nothing: RLS would return almost nothing and a
 * sequential scan over a large table would still look fast. The point is to
 * measure a *large tenant inside a large table*, which is the shape that
 * actually occurs.
 */
async function joinBusiestOrganization(userId) {
  const { rows } = await admin.query(`
    select r.organization_id, count(*)::int as rides
    from rides r
    join organizations o on o.id = r.organization_id
    where o.slug like 'perf-%'
    group by r.organization_id
    order by count(*) desc
    limit 1
  `);
  const organizationId = rows[0].organization_id;

  const membership = await admin.query(
    `
    insert into organization_users (organization_id, user_id, status)
    values ($1, $2, 'ACTIVE')
    returning id
  `,
    [organizationId, userId],
  );

  await admin.query(
    `
    insert into organization_user_roles (organization_user_id, role_id)
    select $1, id from roles where key = 'owner' and is_system
  `,
    [membership.rows[0].id],
  );

  log(`  planner joined the busiest generated organisation (${rows[0].rides} rides)`);
  return organizationId;
}

async function counts() {
  const { rows } = await admin.query(`
    select
      (select count(*) from organizations) as organizations,
      (select count(*) from clients) as clients,
      (select count(*) from rides) as rides,
      (select count(*) from ride_events) as events,
      pg_size_pretty(pg_database_size(current_database())) as size
  `);
  return rows[0];
}

/**
 * Runs one query as a signed-in user and returns its plan and timing.
 *
 * The role switch and the JWT claim are what PostgREST does on every request,
 * so the policies apply exactly as they do in production.
 */
async function explainAsUser(client, userId, label, sql, params = []) {
  await client.query('begin');
  try {
    await client.query('set local role authenticated');
    await client.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);

    // Run once to warm the cache, then measure. A cold first read measures the
    // disk, which is not what an index question is about.
    await client.query(sql, params);
    const { rows } = await client.query(
      `explain (analyze, buffers, format json) ${sql}`,
      params,
    );

    const plan = rows[0]['QUERY PLAN'][0];
    const text = JSON.stringify(plan);
    return {
      label,
      ms: plan['Execution Time'],
      rows: plan.Plan['Actual Rows'],
      seqScans: (text.match(/"Node Type":"Seq Scan"/g) ?? []).length,
      scannedTables: [
        ...text.matchAll(
          /"Node Type":"Seq Scan","Parallel Aware":\w+,"Async Capable":\w+,"Relation Name":"([^"]+)"/g,
        ),
      ].map((match) => match[1]),
    };
  } finally {
    await client.query('rollback');
  }
}

// --- Rebuild, seed, measure ------------------------------------------------
log('Rebuilding the database…');
execSync('bash scripts/db-rebuild.sh', { stdio: 'ignore' });
execSync('npm run db:seed', { stdio: 'ignore' });

await seedVolume();
log(`Volume: ${JSON.stringify(await counts())}`);

/**
 * Identities come from the database, not from constants here.
 *
 * Copying the seed's uuids into this script would be a second place they have
 * to be kept in step, and the first thing to drift silently when the seed
 * changes. Looking them up also means this script keeps working against a
 * database seeded some other way.
 */
async function seededUser(email) {
  const { rows } = await admin.query('select id from profiles where email = $1', [email]);
  if (!rows[0]) throw new Error(`Seed user ${email} not found — run npm run db:seed`);
  return rows[0].id;
}

const PLANNER = await seededUser('planner@ontzorgd.test');
const DRIVER = await seededUser('chauffeur1@ontzorgd.test');
const { rows: demoOrg } = await admin.query(
  "select id from organizations where slug = 'taxi-ontzorgd-demo'",
);
const ORG_A = demoOrg[0].id;

const BIG_ORG = await joinBusiestOrganization(PLANNER);

const user = new pg.Client({ connectionString: AUTHENTICATOR });
await user.connect();

const measurements = [];

measurements.push(
  await explainAsUser(
    user,
    PLANNER,
    "planning: one day's rides",
    `
    select r.id, r.scheduled_pickup_time, r.status, c.first_name, c.last_name
    from rides r join clients c on c.id = r.client_id
    where r.organization_id = $1 and r.scheduled_date = current_date
    order by r.scheduled_pickup_time
  `,
    [ORG_A],
  ),
);

measurements.push(
  await explainAsUser(
    user,
    PLANNER,
    'client list, first page',
    `
    select id, first_name, last_name, city from clients
    where organization_id = $1 and deleted_at is null
    order by last_name limit 25
  `,
    [ORG_A],
  ),
);

// Against the busiest generated organisation, not the demo one: a report over
// a year is only interesting when there is a year of rides to aggregate.
measurements.push(
  await explainAsUser(
    user,
    PLANNER,
    'report: summary over a year (big org)',
    `
    select * from report_ride_summary($1, current_date - 365, current_date)
  `,
    [BIG_ORG],
  ),
);

measurements.push(
  await explainAsUser(
    user,
    PLANNER,
    'report: per driver over a year (big org)',
    `
    select * from report_by_driver($1, current_date - 365, current_date)
  `,
    [BIG_ORG],
  ),
);

measurements.push(
  await explainAsUser(
    user,
    PLANNER,
    'report: per client over a year (big org)',
    `
    select * from report_by_client($1, current_date - 365, current_date)
  `,
    [BIG_ORG],
  ),
);

measurements.push(
  await explainAsUser(
    user,
    PLANNER,
    'planning: a busy day (big org)',
    `
    select r.id, r.scheduled_pickup_time, r.status, c.first_name, c.last_name
    from rides r join clients c on c.id = r.client_id
    where r.organization_id = $1
      and r.scheduled_date between current_date - 365 and current_date
    order by r.scheduled_pickup_at desc limit 50
  `,
    [BIG_ORG],
  ),
);

measurements.push(
  await explainAsUser(
    user,
    PLANNER,
    'events of a busy organisation',
    `
    select e.event_type, e.occurred_at from ride_events e
    where e.organization_id = $1 order by e.occurred_at desc limit 50
  `,
    [BIG_ORG],
  ),
);

measurements.push(
  await explainAsUser(
    user,
    DRIVER,
    "driver: today's assigned rides",
    `
    select id, scheduled_pickup_time, status from rides
    where scheduled_date = current_date order by scheduled_pickup_time
  `,
  ),
);

measurements.push(
  await explainAsUser(
    user,
    PLANNER,
    'ride detail with its events',
    `
    select e.event_type, e.occurred_at, e.source
    from ride_events e
    where e.ride_id = (select id from rides where organization_id = $1 limit 1)
    order by e.occurred_at
  `,
    [ORG_A],
  ),
);

measurements.push(
  await explainAsUser(
    user,
    PLANNER,
    'audit log, most recent page',
    `
    select action, entity_type, created_at from audit_logs
    where organization_id = $1 order by created_at desc limit 50
  `,
    [ORG_A],
  ),
);

log('');
log('Query                                   |    ms | rows | seq scans on');
log('----------------------------------------|-------|------|-------------');
for (const m of measurements) {
  const flag = m.ms > SLOW_MS ? ' <-- SLOW' : '';
  log(
    `${m.label.padEnd(39)} | ${m.ms.toFixed(1).padStart(5)} | ${String(m.rows).padStart(4)} | ${m.scannedTables.join(', ') || '-'}${flag}`,
  );
}

const slow = measurements.filter((m) => m.ms > SLOW_MS);
const scanning = measurements.filter((m) =>
  m.scannedTables.some((table) => ['rides', 'ride_events', 'clients'].includes(table)),
);

log('');
if (slow.length === 0 && scanning.length === 0) {
  log('No query over the threshold and no sequential scan on a large table.');
} else {
  if (slow.length > 0) log(`SLOW: ${slow.map((m) => m.label).join('; ')}`);
  if (scanning.length > 0) {
    log(`SEQUENTIAL SCAN on a large table: ${scanning.map((m) => m.label).join('; ')}`);
  }
}

await user.end();
await admin.end();
process.exitCode = slow.length > 0 || scanning.length > 0 ? 1 : 0;
