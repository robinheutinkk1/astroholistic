import { afterAll, describe, expect, it } from 'vitest';
import { adminConnect, disconnect } from './harness';

/**
 * Structural guarantees about the schema itself.
 *
 * The most common way tenant isolation leaks is not a subtly wrong policy — it
 * is a new table that nobody remembered to protect. These tests fail on that
 * before it reaches production.
 */

afterAll(async () => {
  await disconnect();
});

/**
 * Tables without an `organization_id`, each with the reason it does not need
 * one. Adding an entry here is a deliberate act: it means "this table is scoped
 * some other way", and the reviewer should check that claim.
 */
const NON_TENANT_TABLES = new Map<string, string>([
  ['organizations', 'is the tenant; scoped by its own id'],
  ['permissions', 'static catalogue, no personal data'],
  ['plans', 'public plan catalogue'],
  ['profiles', 'scoped per user, not per organisation'],
  ['platform_admins', 'platform-level, deliberately tenant-free'],
  ['role_permissions', 'scoped through roles'],
  ['organization_user_roles', 'scoped through organization_users'],
  ['client_contacts', 'scoped through clients'],
  ['client_care_organizations', 'scoped through clients'],
  ['care_organization_users', 'scoped through care_organizations'],
  ['driver_vehicles', 'scoped through drivers'],
  ['tag_scan_attempts', 'rate-limit counters, written only by the check-in function'],
]);

describe('schema-level guarantees', () => {
  it('every table in public has row level security enabled', async () => {
    const db = await adminConnect();
    const result = await db.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public' and not rowsecurity
       order by tablename`,
    );
    expect(result.rows.map((r) => r.tablename)).toEqual([]);
  });

  it('every table in public has at least one policy', async () => {
    // RLS enabled with zero policies denies everything, which is safe but is
    // almost always an oversight rather than an intent.
    const db = await adminConnect();
    const result = await db.query<{ tablename: string }>(
      `select t.tablename from pg_tables t
       where t.schemaname = 'public'
         and not exists (
           select 1 from pg_policies p
           where p.schemaname = 'public' and p.tablename = t.tablename
         )
       order by t.tablename`,
    );
    expect(result.rows.map((r) => r.tablename)).toEqual([]);
  });

  it('every tenant table carries an organization_id column', async () => {
    const db = await adminConnect();
    const result = await db.query<{ tablename: string }>(
      `select t.tablename from pg_tables t
       where t.schemaname = 'public'
         and not exists (
           select 1 from information_schema.columns c
           where c.table_schema = 'public'
             and c.table_name = t.tablename
             and c.column_name = 'organization_id'
         )
       order by t.tablename`,
    );
    const unexpected = result.rows
      .map((r) => r.tablename)
      .filter((name) => !NON_TENANT_TABLES.has(name));
    expect(unexpected).toEqual([]);
  });

  it('no policy grants anything to the anon role', async () => {
    const db = await adminConnect();
    const result = await db.query<{ tablename: string; policyname: string }>(
      `select tablename, policyname from pg_policies
       where schemaname = 'public' and 'anon' = any (roles)`,
    );
    expect(result.rows).toEqual([]);
  });

  it('no policy targets PUBLIC, which would include every role', async () => {
    const db = await adminConnect();
    const result = await db.query<{ tablename: string; policyname: string }>(
      `select tablename, policyname from pg_policies
       where schemaname = 'public' and roles = '{public}'`,
    );
    expect(result.rows).toEqual([]);
  });

  it('every INSERT and UPDATE policy has a WITH CHECK clause', async () => {
    // A USING clause alone still allows writing a row INTO another tenant.
    const db = await adminConnect();
    const result = await db.query<{ tablename: string; policyname: string }>(
      `select tablename, policyname from pg_policies
       where schemaname = 'public'
         and cmd in ('INSERT', 'UPDATE')
         and with_check is null
       order by tablename, policyname`,
    );
    expect(result.rows).toEqual([]);
  });

  it('append-only tables have no UPDATE or DELETE policy', async () => {
    const db = await adminConnect();
    const result = await db.query<{ tablename: string; cmd: string }>(
      `select tablename, cmd from pg_policies
       where schemaname = 'public'
         and tablename in ('ride_events', 'audit_logs')
         and cmd in ('UPDATE', 'DELETE')`,
    );
    expect(result.rows).toEqual([]);
  });

  it('append-only tables have UPDATE and DELETE revoked from authenticated', async () => {
    const db = await adminConnect();
    const result = await db.query<{ count: string }>(
      `select count(*)::text as count
       from information_schema.role_table_grants
       where table_schema = 'public'
         and table_name in ('ride_events', 'audit_logs')
         and grantee = 'authenticated'
         and privilege_type in ('UPDATE', 'DELETE')`,
    );
    expect(result.rows[0]?.count).toBe('0');
  });

  it('every app helper function is SECURITY DEFINER with a pinned search_path', async () => {
    // Without `set search_path = ''` a caller can shadow `public` and make a
    // security-definer function read tables of their own choosing.
    const db = await adminConnect();
    const result = await db.query<{ proname: string }>(
      `select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app'
         and p.proname in (
           'member_org_ids','member_permissions','has_permission','permitted_org_ids',
           'is_platform_admin','support_org_ids','driver_ids','contact_client_ids',
           'care_org_client_ids','self_client_ids','driver_visible_client_ids',
           'visible_client_ids','is_member_of'
         )
         and (
           not p.prosecdef
           or coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=%'
         )
       order by p.proname`,
    );
    expect(result.rows.map((r) => r.proname)).toEqual([]);
  });

  it('the ride state machine agrees with the TypeScript implementation', async () => {
    // The rule is expressed twice on purpose (docs/DATABASE.md §7.1): once in
    // TypeScript for good errors and the UI, once in the database so a direct
    // API call cannot bypass it. This test is what keeps the two honest.
    const { RIDE_STATUSES, canTransition } = await import('@/features/rides/status');
    const db = await adminConnect();

    const mismatches: string[] = [];
    for (const from of RIDE_STATUSES) {
      for (const to of RIDE_STATUSES) {
        const result = await db.query<{ allowed: boolean }>(
          'select app.ride_status_transition_allowed($1, $2) as allowed',
          [from, to],
        );
        const inDatabase = result.rows[0]?.allowed ?? false;
        const inTypeScript = from !== to && canTransition(from, to);
        if (inDatabase !== inTypeScript) {
          mismatches.push(`${from} -> ${to}: db=${inDatabase} ts=${inTypeScript}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});
