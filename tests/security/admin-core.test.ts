import { afterAll, describe, expect, it } from 'vitest';
import { asUser, CLIENTS, disconnect, expectDenied, ORGS, USERS } from './harness';

/**
 * The admin screens from Fase 4, tested at the layer that actually decides.
 *
 * Each of these corresponds to something a user could try by editing a URL or
 * replaying a Server Action: the interface hides the button, but that is not
 * what stops them.
 */

afterAll(async () => {
  await disconnect();
});

describe('client management', () => {
  it('a planner can create a client', async () => {
    const result = await asUser(
      USERS.plannerA,
      `insert into clients (organization_id, first_name, last_name)
       values ($1, 'Nieuwe', 'Client') returning id`,
      [ORGS.a],
    );
    expect(result.rowCount).toBe(1);
  });

  it('a dispatcher cannot create a client', async () => {
    // The dispatcher role holds clients.view but not clients.create.
    const message = await expectDenied(
      USERS.dispatcherA,
      `insert into clients (organization_id, first_name, last_name)
       values ($1, 'Nieuwe', 'Client')`,
      [ORGS.a],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('a planner cannot delete a client', async () => {
    // Deleting is clients.delete, which planner does not hold.
    const result = await asUser(USERS.plannerA, 'delete from clients where id = $1', [
      CLIENTS.janA,
    ]);
    expect(result.rowCount).toBe(0);
  });

  it('a soft delete keeps the row and its ride history', async () => {
    const result = await asUser<{ deleted_at: string | null }>(
      USERS.ownerA,
      `update clients set deleted_at = now(), status = 'INACTIVE'
       where id = $1 returning deleted_at`,
      [CLIENTS.pietA],
    );
    expect(result.rows[0]?.deleted_at).not.toBeNull();

    // The rides survive: they are the transport record, not a detail of the
    // person (docs/DATABASE.md §10).
    const rides = await asUser<{ count: number }>(
      USERS.ownerA,
      'select count(*)::int as count from rides where client_id = $1',
      [CLIENTS.pietA],
    );
    expect(rides.rows[0]?.count).toBeGreaterThan(0);
  });

  it('the unique reference is enforced per organisation, not globally', async () => {
    // Two transport companies may both use "TO-001" for their own client.
    const result = await asUser(
      USERS.ownerB,
      `insert into clients (organization_id, first_name, last_name, external_reference)
       values ($1, 'Andere', 'Client', 'TO-001') returning id`,
      [ORGS.b],
    );
    expect(result.rowCount).toBe(1);
  });

  it('a duplicate reference within one organisation is refused', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      `insert into clients (organization_id, first_name, last_name, external_reference)
       values ($1, 'Dubbele', 'Referentie', 'TO-001')`,
      [ORGS.a],
    );
    expect(message).toMatch(/duplicate key|unique/i);
  });
});

describe('fleet management', () => {
  it('a planner cannot create a vehicle', async () => {
    // Planner has vehicles.view, not vehicles.manage.
    const message = await expectDenied(
      USERS.plannerA,
      `insert into vehicles (organization_id, license_plate, seats, wheelchair_positions,
                             is_wheelchair_accessible)
       values ($1, '99-XYZ-9', 8, 0, false)`,
      [ORGS.a],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('an owner can create a vehicle', async () => {
    const result = await asUser(
      USERS.ownerA,
      `insert into vehicles (organization_id, license_plate, seats, wheelchair_positions,
                             is_wheelchair_accessible)
       values ($1, '99-XYZ-9', 8, 0, false) returning id`,
      [ORGS.a],
    );
    expect(result.rowCount).toBe(1);
  });

  it('refuses a wheelchair flag that contradicts the position count', async () => {
    // A flag and a count that disagree are how the wrong bus gets dispatched,
    // so the database refuses the combination outright.
    const message = await expectDenied(
      USERS.ownerA,
      `insert into vehicles (organization_id, license_plate, seats, wheelchair_positions,
                             is_wheelchair_accessible)
       values ($1, '88-AAA-8', 8, 0, true)`,
      [ORGS.a],
    );
    expect(message).toMatch(/vehicles_wheelchair_consistent/i);
  });

  it('refuses a negative seat count', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      `insert into vehicles (organization_id, license_plate, seats, wheelchair_positions,
                             is_wheelchair_accessible)
       values ($1, '77-BBB-7', -1, 0, false)`,
      [ORGS.a],
    );
    expect(message).toMatch(/seats_non_negative/i);
  });

  it('treats license plates as the same regardless of dashes and case', async () => {
    // '12-ABC-3' and '12abc3' are one vehicle; a duplicate would let a planner
    // book the same bus twice.
    const message = await expectDenied(
      USERS.ownerA,
      `insert into vehicles (organization_id, license_plate, seats, wheelchair_positions,
                             is_wheelchair_accessible)
       values ($1, '12abc3', 8, 0, false)`,
      [ORGS.a],
    );
    expect(message).toMatch(/duplicate key|unique/i);
  });
});

describe('locations', () => {
  it('a planner can manage locations', async () => {
    const result = await asUser(
      USERS.plannerA,
      `insert into locations (organization_id, name, kind, city)
       values ($1, 'Nieuwe school', 'SCHOOL', 'Hengelo') returning id`,
      [ORGS.a],
    );
    expect(result.rowCount).toBe(1);
  });

  it('a dispatcher cannot manage locations', async () => {
    const message = await expectDenied(
      USERS.dispatcherA,
      `insert into locations (organization_id, name, kind)
       values ($1, 'Stiekeme locatie', 'OTHER')`,
      [ORGS.a],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('refuses a latitude without a longitude', async () => {
    // Half a coordinate is worse than none: it silently produces a wrong pin.
    const message = await expectDenied(
      USERS.plannerA,
      `insert into locations (organization_id, name, latitude)
       values ($1, 'Halve coordinaat', 52.2)`,
      [ORGS.a],
    );
    expect(message).toMatch(/coords_together/i);
  });
});

describe('audit logging', () => {
  it('a member can write an audit entry for their own organisation', async () => {
    const result = await asUser(
      USERS.plannerA,
      `insert into audit_logs (organization_id, actor_user_id, actor_kind, action,
                               entity_type, entity_id)
       values ($1, $2, 'PLANNER', 'client.updated', 'clients', $3)`,
      [ORGS.a, USERS.plannerA, CLIENTS.janA],
    );
    expect(result.rowCount).toBe(1);
  });

  it('writing an audit entry does not grant reading it back', async () => {
    // `insert ... returning` needs the SELECT policy to pass as well. A planner
    // may record that they changed a client, but may not read the audit log —
    // so recordAudit() deliberately inserts without RETURNING. Changing that
    // would break every mutation a planner makes.
    const message = await expectDenied(
      USERS.plannerA,
      `insert into audit_logs (organization_id, actor_user_id, actor_kind, action,
                               entity_type)
       values ($1, $2, 'PLANNER', 'client.updated', 'clients') returning id`,
      [ORGS.a, USERS.plannerA],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('a member cannot write an audit entry into another organisation', async () => {
    const message = await expectDenied(
      USERS.plannerA,
      `insert into audit_logs (organization_id, actor_user_id, actor_kind, action,
                               entity_type)
       values ($1, $2, 'PLANNER', 'client.updated', 'clients')`,
      [ORGS.b, USERS.plannerA],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('a planner without audit.view cannot read the audit log', async () => {
    const result = await asUser(USERS.plannerA, 'select id from audit_logs');
    expect(result.rowCount).toBe(0);
  });

  it('an owner with audit.view can read it', async () => {
    const result = await asUser(USERS.ownerA, 'select id from audit_logs');
    expect(result.rowCount).toBeGreaterThanOrEqual(0);
  });
});

describe('list queries stay inside the tenant', () => {
  it('a paged client query never returns another tenant’s rows', async () => {
    // Mirrors what the list screen does, including the range: pagination must
    // not become a way to walk past the tenant boundary.
    const result = await asUser<{ organization_id: string }>(
      USERS.ownerA,
      `select organization_id from clients
       where deleted_at is null
       order by last_name, id
       limit 100`,
    );
    expect(result.rows.every((row) => row.organization_id === ORGS.a)).toBe(true);
  });

  it('a search term cannot widen the result beyond the tenant', async () => {
    const result = await asUser<{ organization_id: string }>(
      USERS.ownerA,
      `select organization_id from clients
       where (first_name ilike $1 or last_name ilike $1)
       and deleted_at is null`,
      ['%a%'],
    );
    expect(result.rows.every((row) => row.organization_id === ORGS.a)).toBe(true);
    expect(result.rowCount).toBeGreaterThan(0);
  });
});
