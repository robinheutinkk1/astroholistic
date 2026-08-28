import { Client } from 'pg';

/**
 * Test harness for the tenant-isolation suite.
 *
 * It connects as the `authenticator` login role and then does exactly what
 * PostgREST does on every request:
 *
 *   set local role authenticated;
 *   set local request.jwt.claims = '{"sub": "<user id>", "role": "authenticated"}';
 *
 * That matters. Running these assertions as the superuser or the table owner
 * would bypass RLS entirely and the suite would pass while proving nothing.
 * `authenticated` owns none of the tables, so the policies actually apply.
 */

const CONNECTION_STRING =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://authenticator@localhost:5433/postgres?host=/tmp';

/**
 * Owner connection, used only to arrange preconditions a test subject is not
 * allowed to arrange for themselves. Never used to make an assertion — that
 * would bypass RLS and prove nothing.
 */
const ADMIN_CONNECTION_STRING =
  process.env['TEST_DATABASE_ADMIN_URL'] ??
  'postgresql://postgres@localhost:5433/postgres?host=/tmp';

/** Seeded identities. Organisation A is Taxi Ontzorgd, B is Voorbeeld Taxi. */
export const USERS = {
  ownerA: 'a0000000-0000-4000-8000-000000000001',
  plannerA: 'a0000000-0000-4000-8000-000000000002',
  dispatcherA: 'a0000000-0000-4000-8000-000000000003',
  driverA1: 'a0000000-0000-4000-8000-000000000004',
  driverA2: 'a0000000-0000-4000-8000-000000000005',
  parentA: 'a0000000-0000-4000-8000-000000000006',
  careA: 'a0000000-0000-4000-8000-000000000007',
  clientA: 'a0000000-0000-4000-8000-000000000008',
  ownerB: 'b0000000-0000-4000-8000-000000000001',
  driverB: 'b0000000-0000-4000-8000-000000000004',
  platformAdmin: 'c0000000-0000-4000-8000-000000000001',
  outsider: 'd0000000-0000-4000-8000-000000000001',
} as const;

export const ORGS = {
  a: '0a000000-0000-4000-8000-000000000000',
  b: '0b000000-0000-4000-8000-000000000000',
} as const;

export const CLIENTS = {
  /** Org A, has a portal login, linked to parent Olga and to care org De Brug. */
  janA: '30000000-0000-4000-8000-00000000000a',
  /** Org A, driven by driver A2. Olga must NOT see this one. */
  pietA: '30000000-0000-4000-8000-00000000000b',
  fatimaA: '30000000-0000-4000-8000-00000000000c',
  /** Org B. */
  klaasB: '30000000-0000-4000-8000-00000000001a',
} as const;

export const RIDES = {
  /** Org A, driver A1, client Jan. */
  janA: '80000000-0000-4000-8000-00000000000a',
  /** Org A, driver A2, client Piet. */
  pietA: '80000000-0000-4000-8000-00000000000b',
  /** Org A, unassigned. */
  unassignedA: '80000000-0000-4000-8000-00000000000c',
  /** Org B. */
  klaasB: '80000000-0000-4000-8000-00000000001a',
} as const;

export const TAGS = {
  janA: '90000000-0000-4000-8000-00000000000a',
  klaasB: '90000000-0000-4000-8000-00000000001a',
} as const;

export const DRIVERS = {
  keesA: '50000000-0000-4000-8000-00000000000a',
  sanneA: '50000000-0000-4000-8000-00000000000b',
  basB: '50000000-0000-4000-8000-00000000001a',
} as const;

export const ROLES_KEYS = { owner: 'owner', driver: 'driver' } as const;

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

let client: Client | undefined;
let adminClient: Client | undefined;

export async function connect(): Promise<Client> {
  if (!client) {
    client = new Client({ connectionString: CONNECTION_STRING });
    await client.connect();
  }
  return client;
}

/**
 * Owner connection for schema introspection only.
 *
 * The `authenticator` role deliberately holds no privileges, so it cannot even
 * read information_schema meaningfully — a coverage query run as that role
 * would report every table as missing and pass or fail for the wrong reason.
 * Never use this connection to assert what a user can see.
 */
export async function adminConnect(): Promise<Client> {
  if (!adminClient) {
    adminClient = new Client({ connectionString: ADMIN_CONNECTION_STRING });
    await adminClient.connect();
  }
  return adminClient;
}

export async function disconnect(): Promise<void> {
  if (client) {
    await client.end();
    client = undefined;
  }
  if (adminClient) {
    await adminClient.end();
    adminClient = undefined;
  }
}

/**
 * Runs SQL as the given signed-in user, inside a transaction that is always
 * rolled back. Tests can therefore attempt writes without contaminating each
 * other or the seed data.
 */
export async function asUser<T = Record<string, unknown>>(
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const db = await connect();
  await db.query('begin');
  try {
    const role = userId ? 'authenticated' : 'anon';
    const claims = userId
      ? JSON.stringify({ sub: userId, role })
      : JSON.stringify({ role });
    await db.query(`set local role ${role}`);
    await db.query('select set_config($1, $2, true)', ['request.jwt.claims', claims]);

    const result = await db.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  } finally {
    await db.query('rollback');
  }
}

/** Asserts a statement is refused, returning the Postgres error message. */
export async function expectDenied(
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<string> {
  try {
    await asUser(userId, sql, params);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error(`Expected the statement to be denied, but it succeeded:\n${sql}`);
}

/**
 * Runs a privileged setup statement and then a user-scoped read, in one
 * transaction that is rolled back.
 *
 * Needed for the revocation tests: they must change membership and then
 * immediately read as the affected user. The setup half cannot run as
 * `authenticated` (that user is not allowed to suspend themselves) nor as
 * `authenticator` (which deliberately holds no privileges at all), so it runs
 * as the owner connection before the role switch.
 */
export async function setupThenRead<T = Record<string, unknown>>(
  setup: { sql: string; params?: unknown[] },
  read: { userId: string; sql: string; params?: unknown[] },
): Promise<QueryResult<T>> {
  const admin = new Client({ connectionString: ADMIN_CONNECTION_STRING });
  await admin.connect();
  try {
    await admin.query('begin');
    await admin.query(setup.sql, setup.params ?? []);
    await admin.query('set local role authenticated');
    await admin.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({ sub: read.userId, role: 'authenticated' }),
    ]);
    const result = await admin.query(read.sql, read.params ?? []);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  } finally {
    await admin.query('rollback');
    await admin.end();
  }
}

/** Convenience: how many rows of a table this user can see, with a filter. */
export async function countVisible(
  userId: string | null,
  table: string,
  where = 'true',
  params: unknown[] = [],
): Promise<number> {
  const result = await asUser<{ count: string }>(
    userId,
    `select count(*)::text as count from ${table} where ${where}`,
    params,
  );
  return Number(result.rows[0]?.count ?? '0');
}
