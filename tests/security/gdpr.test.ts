import { afterAll, describe, expect, it } from 'vitest';
import {
  CLIENTS,
  ORGS,
  USERS,
  asServiceRoleSteps,
  asUser,
  asUserSteps,
  disconnect,
  expectDeniedSteps,
} from './harness';

/**
 * Erasure is the one operation that is supposed to destroy data, which makes
 * every boundary around it matter twice: who may run it, on whom, and what it
 * must leave standing.
 *
 * Matrix entries S47–S53 in docs/SECURITY.md.
 */
afterAll(disconnect);

describe('S47 — export is scoped like everything else', () => {
  it('a planner exports their own client', async () => {
    const rows = await asUser<{ d: Record<string, unknown> }>(
      USERS.plannerA,
      'select export_client_data($1, $2) as d',
      [ORGS.a, CLIENTS.janA],
    );
    expect(rows.rows[0]?.d).toBeTruthy();
  });

  it("a planner cannot export another organisation's client", async () => {
    const rows = await asUser<{ d: unknown }>(
      USERS.plannerA,
      'select export_client_data($1, $2) as d',
      [ORGS.b, CLIENTS.klaasB],
    );
    expect(rows.rows[0]?.d).toBeNull();
  });

  it('mixing an organisation with a foreign client id yields nothing', async () => {
    // The obvious probe: keep the organisation you are allowed to name and
    // swap in an id from somewhere else.
    const rows = await asUser<{ d: unknown }>(
      USERS.plannerA,
      'select export_client_data($1, $2) as d',
      [ORGS.a, CLIENTS.klaasB],
    );
    expect(rows.rows[0]?.d).toBeNull();
  });

  it('a driver cannot export anyone', async () => {
    const rows = await asUser<{ d: unknown }>(
      USERS.driverA1,
      'select export_client_data($1, $2) as d',
      [ORGS.a, CLIENTS.janA],
    );
    expect(rows.rows[0]?.d).toBeNull();
  });
});

describe('S48 — erasure is scoped and idempotent', () => {
  it('an owner erases their own client', async () => {
    const rows = await asUserSteps<{ first_name: string; anonymized_at: string | null }>(
      USERS.ownerA,
      [
        { sql: 'select * from anonymize_client($1, $2)', params: [ORGS.a, CLIENTS.janA] },
        {
          sql: 'select first_name, anonymized_at from clients where id = $1',
          params: [CLIENTS.janA],
        },
      ],
    );
    expect(rows.rows[0]?.first_name).toBe('Verwijderd');
    expect(rows.rows[0]?.anonymized_at).not.toBeNull();
  });

  it("an owner of A cannot erase B's client", async () => {
    const rows = await asUserSteps<{ first_name: string }>(USERS.ownerA, [
      { sql: 'select * from anonymize_client($1, $2)', params: [ORGS.b, CLIENTS.klaasB] },
      {
        sql: 'select first_name from clients where id = $1',
        params: [CLIENTS.klaasB],
      },
    ]);
    // The owner of A cannot even read that row, so the assertion is on the
    // effect: nothing changed, checked from a vantage point that can see it.
    const check = await asUser<{ first_name: string }>(
      USERS.ownerB,
      'select first_name from clients where id = $1',
      [CLIENTS.klaasB],
    );
    expect(rows.rowCount).toBe(0);
    expect(check.rows[0]?.first_name).not.toBe('Verwijderd');
  });

  it('a driver cannot erase anyone', async () => {
    const rows = await asUserSteps(USERS.driverA1, [
      { sql: 'select * from anonymize_client($1, $2)', params: [ORGS.a, CLIENTS.janA] },
    ]);
    expect(rows.rowCount).toBe(0);
  });

  it('a parent cannot erase their own child', async () => {
    // A data-subject request is made to the organisation, which carries it out.
    // Self-service erasure would let one parent destroy the record another
    // parent, or the transport company, is required to keep.
    const rows = await asUserSteps(USERS.parentA, [
      { sql: 'select * from anonymize_client($1, $2)', params: [ORGS.a, CLIENTS.janA] },
    ]);
    expect(rows.rowCount).toBe(0);
  });

  it('erasing twice changes nothing the second time', async () => {
    const rows = await asUserSteps(USERS.ownerA, [
      { sql: 'select * from anonymize_client($1, $2)', params: [ORGS.a, CLIENTS.janA] },
      { sql: 'select * from anonymize_client($1, $2)', params: [ORGS.a, CLIENTS.janA] },
    ]);
    expect(rows.rowCount).toBe(0);
  });
});

describe('S49 — erasure keeps the transport record', () => {
  it('the rides survive', async () => {
    // The whole design decision in one assertion. If this ever returns 0, the
    // erasure path has started deleting the administration with the person.
    const rows = await asUserSteps<{ count: string }>(USERS.ownerA, [
      { sql: 'select * from anonymize_client($1, $2)', params: [ORGS.a, CLIENTS.janA] },
      {
        sql: 'select count(*)::text as count from rides where client_id = $1',
        params: [CLIENTS.janA],
      },
    ]);
    expect(Number(rows.rows[0]?.count)).toBeGreaterThan(0);
  });

  it('the audit trail survives', async () => {
    const rows = await asUserSteps<{ count: string }>(USERS.ownerA, [
      { sql: 'select * from anonymize_client($1, $2)', params: [ORGS.a, CLIENTS.janA] },
      {
        sql: 'select count(*)::text as count from ride_events where organization_id = $1',
        params: [ORGS.a],
      },
    ]);
    expect(Number(rows.rows[0]?.count)).toBeGreaterThan(0);
  });
});

describe('S50 — erasure leaves nothing pointing at the person', () => {
  it('detaches the NFC tag', async () => {
    // A physical sticker is out in the world. After erasure it must stop
    // resolving to anybody at all.
    const rows = await asUserSteps<{ count: string }>(USERS.ownerA, [
      { sql: 'select * from anonymize_client($1, $2)', params: [ORGS.a, CLIENTS.janA] },
      {
        sql: "select count(*)::text as count from nfc_tags where client_id = $1 or (status = 'ACTIVE' and client_id is null)",
        params: [CLIENTS.janA],
      },
    ]);
    expect(rows.rows[0]?.count).toBe('0');
  });

  it('removes the contact links', async () => {
    const rows = await asUserSteps<{ count: string }>(USERS.ownerA, [
      { sql: 'select * from anonymize_client($1, $2)', params: [ORGS.a, CLIENTS.janA] },
      {
        sql: 'select count(*)::text as count from client_contacts where client_id = $1',
        params: [CLIENTS.janA],
      },
    ]);
    expect(rows.rows[0]?.count).toBe('0');
  });

  it('clears the contact details, not just the name', async () => {
    const rows = await asUserSteps<{
      email: string | null;
      phone: string | null;
      address_line1: string | null;
      user_id: string | null;
    }>(USERS.ownerA, [
      { sql: 'select * from anonymize_client($1, $2)', params: [ORGS.a, CLIENTS.janA] },
      {
        sql: 'select email, phone, address_line1, user_id from clients where id = $1',
        params: [CLIENTS.janA],
      },
    ]);
    const row = rows.rows[0];
    expect([row?.email, row?.phone, row?.address_line1, row?.user_id]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});

describe('S51 — the retention sweep only runs when asked', () => {
  it('does nothing while auto-anonymisation is off', async () => {
    const rows = await asServiceRoleSteps<{ applied: number }>([
      { sql: 'select apply_retention($1) as applied', params: [ORGS.a] },
    ]);
    expect(rows.rows[0]?.applied).toBe(0);
  });

  it('does nothing for an organisation with no policy at all', async () => {
    const rows = await asServiceRoleSteps<{ applied: number }>([
      { sql: 'select apply_retention($1) as applied', params: [ORGS.b] },
    ]);
    expect(rows.rows[0]?.applied).toBe(0);
  });

  it('anonymises long-inactive clients once it is switched on', async () => {
    const rows = await asServiceRoleSteps<{ applied: number }>([
      {
        sql: `insert into retention_policies
                (organization_id, inactive_client_months, auto_anonymize_enabled)
              values ($1, 6, true)
              on conflict (organization_id) do update
                set inactive_client_months = 6, auto_anonymize_enabled = true`,
        params: [ORGS.a],
      },
      {
        // Push every ride far enough back that the whole organisation qualifies.
        sql: "update rides set scheduled_date = current_date - interval '5 years' where organization_id = $1",
        params: [ORGS.a],
      },
      { sql: 'select apply_retention($1) as applied', params: [ORGS.a] },
    ]);
    expect(rows.rows[0]?.applied).toBeGreaterThan(0);
  });

  it('never reaches another organisation', async () => {
    const rows = await asServiceRoleSteps<{ count: string }>([
      {
        sql: `insert into retention_policies
                (organization_id, inactive_client_months, auto_anonymize_enabled)
              values ($1, 6, true)
              on conflict (organization_id) do update
                set inactive_client_months = 6, auto_anonymize_enabled = true`,
        params: [ORGS.a],
      },
      {
        sql: "update rides set scheduled_date = current_date - interval '5 years'",
      },
      { sql: 'select apply_retention($1)', params: [ORGS.a] },
      {
        sql: 'select count(*)::text as count from clients where organization_id = $1 and anonymized_at is not null',
        params: [ORGS.b],
      },
    ]);
    expect(rows.rows[0]?.count).toBe('0');
  });
});

describe('S52 — a tenant cannot widen its own retention reach', () => {
  it('cannot write another organisation policy', async () => {
    // An INSERT that fails WITH CHECK raises rather than quietly doing nothing,
    // which is the right shape: silently discarding a write would leave the
    // caller believing they had configured something.
    const message = await expectDeniedSteps(USERS.ownerA, [
      {
        sql: 'insert into retention_policies (organization_id) values ($1)',
        params: [ORGS.b],
      },
    ]);
    expect(message).toContain('row-level security');
  });

  it('can write its own policy', async () => {
    const rows = await asUserSteps(USERS.ownerA, [
      {
        sql: 'insert into retention_policies (organization_id) values ($1) on conflict (organization_id) do update set inactive_client_months = 12',
        params: [ORGS.a],
      },
    ]);
    expect(rows.rowCount).toBe(1);
  });

  it('cannot call the sweep at all', async () => {
    let message = '';
    try {
      await asUserSteps(USERS.ownerA, [
        { sql: 'select apply_retention($1)', params: [ORGS.a] },
      ]);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    // The sweep is service-role only: it is SECURITY DEFINER, so a tenant
    // reaching it would be reaching past their own RLS.
    expect(message).toContain('permission denied');
  });
});

describe('S53 — the care-organisation policy no longer recurses', () => {
  it('a care co-ordinator can read their own care organisation', async () => {
    // Regression test for the defect fixed in migration 0025: two policies
    // referring to each other made this query fail outright, for exactly the
    // role the second branch of the policy was written for.
    const rows = await asUser(USERS.careA, 'select id, name from care_organizations');
    expect(rows.rowCount).toBe(1);
  });

  it('and not another organisation', async () => {
    const rows = await asUser(
      USERS.careA,
      'select id from care_organizations where organization_id = $1',
      [ORGS.b],
    );
    expect(rows.rowCount).toBe(0);
  });
});
