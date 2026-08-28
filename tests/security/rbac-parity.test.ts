import { afterAll, describe, expect, it } from 'vitest';
import { adminConnect, asUser, disconnect, ORGS, USERS } from './harness';
import {
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  SYSTEM_ROLE_KEYS,
} from '@/features/rbac/permissions';

/**
 * The TypeScript permission catalogue and the database must agree.
 *
 * They are written twice on purpose: the typed list turns a misspelled
 * permission into a compile error, while the database is what actually decides.
 * A drift between them is silent — a permission that exists in code but not in
 * the database simply denies everything, with no error anywhere.
 */

afterAll(async () => {
  await disconnect();
});

describe('permission catalogue parity', () => {
  it('every permission in the database exists in the TypeScript list', async () => {
    const db = await adminConnect();
    const result = await db.query<{ key: string }>(
      'select key from permissions order by key',
    );
    const inDatabase = result.rows.map((r) => r.key);
    const inCode = new Set<string>(PERMISSIONS);
    expect(inDatabase.filter((key) => !inCode.has(key))).toEqual([]);
  });

  it('every permission in the TypeScript list exists in the database', async () => {
    const db = await adminConnect();
    const result = await db.query<{ key: string }>('select key from permissions');
    const inDatabase = new Set(result.rows.map((r) => r.key));
    expect([...PERMISSIONS].filter((key) => !inDatabase.has(key))).toEqual([]);
  });

  it('every system role in the database exists in the TypeScript list', async () => {
    const db = await adminConnect();
    const result = await db.query<{ key: string }>(
      'select key from roles where is_system order by key',
    );
    const inCode = new Set<string>(SYSTEM_ROLE_KEYS);
    expect(result.rows.map((r) => r.key).filter((key) => !inCode.has(key))).toEqual([]);
  });

  it('every system role has a Dutch label and description', () => {
    for (const key of SYSTEM_ROLE_KEYS) {
      expect(ROLE_LABELS[key], `label for ${key}`).toBeTruthy();
      expect(ROLE_DESCRIPTIONS[key], `description for ${key}`).toBeTruthy();
    }
  });
});

describe('role composition matches the documented matrix', () => {
  it('a driver has no access to the client list', async () => {
    // The literal requirement from masterprompt §4, asserted against the data
    // rather than against the documentation.
    const db = await adminConnect();
    const result = await db.query<{ permission_key: string }>(
      `select rp.permission_key from role_permissions rp
       join roles r on r.id = rp.role_id
       where r.key = 'driver' and r.is_system`,
    );
    const keys = result.rows.map((r) => r.permission_key);
    expect(keys).not.toContain('clients.view');
    expect(keys).toContain('rides.view.assigned');
  });

  it('only the owner may manage roles and domains', async () => {
    const db = await adminConnect();
    for (const permission of ['organization.roles.manage', 'domain.manage']) {
      const result = await db.query<{ key: string }>(
        `select r.key from role_permissions rp
         join roles r on r.id = rp.role_id
         where r.is_system and rp.permission_key = $1`,
        [permission],
      );
      expect(result.rows.map((r) => r.key)).toEqual(['owner']);
    }
  });

  it('a read-only role holds no write permission', async () => {
    const db = await adminConnect();
    const result = await db.query<{ permission_key: string }>(
      `select rp.permission_key from role_permissions rp
       join roles r on r.id = rp.role_id
       where r.key = 'readonly' and r.is_system`,
    );
    const writeLike = result.rows
      .map((r) => r.permission_key)
      .filter((key) =>
        /\.(create|update|delete|manage|cancel|dispatch|force_status)/.test(key),
      );
    expect(writeLike).toEqual([]);
  });

  it('no system role holds a platform permission', async () => {
    // Platform rights belong to platform_admins, never to a tenant role —
    // otherwise an organisation owner could reach across tenants.
    const db = await adminConnect();
    const result = await db.query<{ key: string; permission_key: string }>(
      `select r.key, rp.permission_key from role_permissions rp
       join roles r on r.id = rp.role_id
       join permissions p on p.key = rp.permission_key
       where r.is_system and p.category = 'platform'`,
    );
    expect(result.rows).toEqual([]);
  });
});

describe('the effective permissions a user really gets', () => {
  it('matches for the seeded planner', async () => {
    const result = await asUser<{ permission_key: string }>(
      USERS.plannerA,
      'select permission_key from app.member_permissions() where organization_id = $1',
      [ORGS.a],
    );
    const keys = result.rows.map((r) => r.permission_key);
    expect(keys).toContain('rides.create');
    expect(keys).toContain('clients.update');
    expect(keys).not.toContain('rides.dispatch');
    expect(keys).not.toContain('organization.roles.manage');
  });

  it('is empty for a user with no membership', async () => {
    const result = await asUser(
      USERS.outsider,
      'select permission_key from app.member_permissions()',
    );
    expect(result.rowCount).toBe(0);
  });

  it('is empty for a suspended organisation', async () => {
    const result = await asUser<{ permission_key: string }>(
      USERS.ownerB,
      'select permission_key from app.member_permissions() where organization_id = $1',
      [ORGS.a],
    );
    expect(result.rowCount).toBe(0);
  });
});
