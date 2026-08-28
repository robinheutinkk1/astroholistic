import { afterAll, describe, expect, it } from 'vitest';
import {
  asUser,
  CLIENTS,
  countVisible,
  disconnect,
  DRIVERS,
  expectDenied,
  ORGS,
  RIDES,
  setupThenRead,
  TAGS,
  USERS,
} from './harness';

/**
 * The tenant-isolation suite (docs/SECURITY.md §8, masterprompt §54).
 *
 * These are not unit tests of a function. Each case is an attempted break-in
 * against a real database, as a real signed-in user, through the same path the
 * application uses. If any of these turns green→red, the platform is leaking.
 */

afterAll(async () => {
  await disconnect();
});

describe('S1–S4 · organisation against organisation', () => {
  it("S1 · org A cannot read org B's ride", async () => {
    expect(await countVisible(USERS.ownerA, 'rides', 'id = $1', [RIDES.klaasB])).toBe(0);
  });

  it('S1b · org B genuinely can read its own ride (proves the test is not vacuous)', async () => {
    expect(await countVisible(USERS.ownerB, 'rides', 'id = $1', [RIDES.klaasB])).toBe(1);
  });

  it("S2 · org A cannot update org B's client", async () => {
    const result = await asUser(
      USERS.ownerA,
      "update clients set city = 'Hacked' where id = $1",
      [CLIENTS.klaasB],
    );
    expect(result.rowCount).toBe(0);
  });

  it('S3 · org A cannot insert a ride into org B', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      `insert into rides (organization_id, client_id, scheduled_date, scheduled_pickup_time,
                          scheduled_pickup_at, pickup_location_id, destination_location_id)
       select $1, $2, current_date, '08:00', now(),
              '10000000-0000-4000-8000-00000000001a', '10000000-0000-4000-8000-00000000001b'`,
      [ORGS.b, CLIENTS.klaasB],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it("S4 · org A cannot delete org B's client", async () => {
    const result = await asUser(USERS.ownerA, 'delete from clients where id = $1', [
      CLIENTS.klaasB,
    ]);
    expect(result.rowCount).toBe(0);
  });

  it('S4b · org A sees exactly its own five clients, no more', async () => {
    expect(await countVisible(USERS.ownerA, 'clients')).toBe(5);
  });

  it('S4c · org A cannot move one of its own clients into org B', async () => {
    // A WITH CHECK failure, not a USING failure: the row is visible, but the
    // new organization_id is not permitted.
    const message = await expectDenied(
      USERS.ownerA,
      'update clients set organization_id = $1 where id = $2',
      [ORGS.b, CLIENTS.janA],
    );
    expect(message).toMatch(/row-level security/i);
  });
});

describe('S5–S7 · drivers', () => {
  it('S5 · a driver cannot read a client they have no ride for', async () => {
    expect(
      await countVisible(USERS.driverA1, 'clients', 'id = $1', [CLIENTS.fatimaA]),
    ).toBe(0);
  });

  it('S5b · a driver CAN read the client on their own ride', async () => {
    expect(await countVisible(USERS.driverA1, 'clients', 'id = $1', [CLIENTS.janA])).toBe(
      1,
    );
  });

  it('S5c · a driver has no browsable client list', async () => {
    // The literal requirement from §4: never all clients of the organisation.
    const visible = await countVisible(USERS.driverA1, 'clients');
    expect(visible).toBe(1);
  });

  it("S6 · a driver cannot read a colleague's ride", async () => {
    expect(await countVisible(USERS.driverA1, 'rides', 'id = $1', [RIDES.pietA])).toBe(0);
  });

  it('S6b · a driver cannot read an unassigned ride in their own organisation', async () => {
    expect(
      await countVisible(USERS.driverA1, 'rides', 'id = $1', [RIDES.unassignedA]),
    ).toBe(0);
  });

  it("S6c · a driver cannot reassign a colleague's ride to themselves", async () => {
    const result = await asUser(
      USERS.driverA1,
      'update rides set driver_id = $1 where id = $2',
      [DRIVERS.keesA, RIDES.pietA],
    );
    expect(result.rowCount).toBe(0);
  });

  it('S7 · a driver cannot skip the workflow from DRIVER_ASSIGNED to COMPLETED', async () => {
    const message = await expectDenied(
      USERS.driverA1,
      "update rides set status = 'COMPLETED' where id = $1",
      [RIDES.janA],
    );
    expect(message).toMatch(/illegal ride status transition/i);
  });

  it('S7b · a driver CAN make a legal transition on their own ride', async () => {
    const result = await asUser(
      USERS.driverA1,
      "update rides set status = 'DRIVER_EN_ROUTE' where id = $1",
      [RIDES.janA],
    );
    expect(result.rowCount).toBe(1);
  });

  it('S7c · a driver from org B cannot touch an org A ride', async () => {
    const result = await asUser(
      USERS.driverB,
      "update rides set status = 'CANCELLED' where id = $1",
      [RIDES.janA],
    );
    expect(result.rowCount).toBe(0);
  });
});

describe('S8–S9 · parent / contact portal', () => {
  it('S8 · a parent cannot see another client in the same organisation', async () => {
    expect(await countVisible(USERS.parentA, 'clients', 'id = $1', [CLIENTS.pietA])).toBe(
      0,
    );
  });

  it('S8b · a parent CAN see their own linked client', async () => {
    expect(await countVisible(USERS.parentA, 'clients', 'id = $1', [CLIENTS.janA])).toBe(
      1,
    );
  });

  it('S8c · a parent sees exactly one client in total', async () => {
    expect(await countVisible(USERS.parentA, 'clients')).toBe(1);
  });

  it("S8d · a parent cannot see another client's rides", async () => {
    expect(await countVisible(USERS.parentA, 'rides', 'id = $1', [RIDES.pietA])).toBe(0);
  });

  it('S9 · a parent cannot modify a ride directly', async () => {
    // Decision D-08: portals file a change_request; they never write to rides.
    const result = await asUser(
      USERS.parentA,
      "update rides set status = 'CANCELLED' where id = $1",
      [RIDES.janA],
    );
    expect(result.rowCount).toBe(0);
  });

  it('S9b · a parent CAN file a change request for their own client', async () => {
    const result = await asUser(
      USERS.parentA,
      `insert into change_requests (organization_id, client_id, ride_id, requested_by_user_id,
                                    requester_kind, kind)
       values ($1, $2, $3, $4, 'CONTACT', 'ABSENCE') returning id`,
      [ORGS.a, CLIENTS.janA, RIDES.janA, USERS.parentA],
    );
    expect(result.rowCount).toBe(1);
  });

  it('S9c · a parent cannot file a change request for a client they cannot see', async () => {
    const message = await expectDenied(
      USERS.parentA,
      `insert into change_requests (organization_id, client_id, requested_by_user_id,
                                    requester_kind, kind)
       values ($1, $2, $3, 'CONTACT', 'CANCEL')`,
      [ORGS.a, CLIENTS.pietA, USERS.parentA],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('S9d · a parent cannot file a change request in someone else’s name', async () => {
    const message = await expectDenied(
      USERS.parentA,
      `insert into change_requests (organization_id, client_id, requested_by_user_id,
                                    requester_kind, kind)
       values ($1, $2, $3, 'CONTACT', 'CANCEL')`,
      [ORGS.a, CLIENTS.janA, USERS.plannerA],
    );
    expect(message).toMatch(/row-level security/i);
  });
});

describe('S10 · care organisation portal', () => {
  it('S10 · a care organisation cannot see a client it does not fund', async () => {
    expect(await countVisible(USERS.careA, 'clients', 'id = $1', [CLIENTS.pietA])).toBe(
      0,
    );
  });

  it('S10b · a care organisation CAN see the client it funds', async () => {
    expect(await countVisible(USERS.careA, 'clients', 'id = $1', [CLIENTS.janA])).toBe(1);
  });

  it('S10c · a care organisation cannot see clients of another tenant', async () => {
    expect(await countVisible(USERS.careA, 'clients', 'id = $1', [CLIENTS.klaasB])).toBe(
      0,
    );
  });
});

describe('S11 · client portal', () => {
  it('S11 · a client cannot read another client', async () => {
    expect(await countVisible(USERS.clientA, 'clients', 'id = $1', [CLIENTS.pietA])).toBe(
      0,
    );
  });

  it('S11b · a client sees only themselves', async () => {
    const result = await asUser<{ id: string }>(USERS.clientA, 'select id from clients');
    expect(result.rows.map((r) => r.id)).toEqual([CLIENTS.janA]);
  });

  it('S11c · a client cannot cancel their own ride directly', async () => {
    const result = await asUser(
      USERS.clientA,
      "update rides set status = 'CANCELLED' where id = $1",
      [RIDES.janA],
    );
    expect(result.rowCount).toBe(0);
  });
});

describe('S12–S14 · permissions and privilege escalation', () => {
  it('S12 · a dispatcher without clients.create cannot create a client', async () => {
    const message = await expectDenied(
      USERS.dispatcherA,
      `insert into clients (organization_id, first_name, last_name)
       values ($1, 'Test', 'Persoon')`,
      [ORGS.a],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('S12b · a planner WITH clients.create can', async () => {
    const result = await asUser(
      USERS.plannerA,
      `insert into clients (organization_id, first_name, last_name)
       values ($1, 'Test', 'Persoon') returning id`,
      [ORGS.a],
    );
    expect(result.rowCount).toBe(1);
  });

  it('S12c · a driver cannot create a client', async () => {
    const message = await expectDenied(
      USERS.driverA1,
      `insert into clients (organization_id, first_name, last_name)
       values ($1, 'Test', 'Persoon')`,
      [ORGS.a],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('S13 · a user cannot grant themselves the owner role', async () => {
    const message = await expectDenied(
      USERS.plannerA,
      `insert into organization_user_roles (organization_user_id, role_id)
       select ou.id, r.id
       from organization_users ou, roles r
       where ou.user_id = $1 and ou.organization_id = $2
         and r.key = 'owner' and r.is_system`,
      [USERS.plannerA, ORGS.a],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('S13b · even an owner cannot change their own roles', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      `insert into organization_user_roles (organization_user_id, role_id)
       select ou.id, r.id
       from organization_users ou, roles r
       where ou.user_id = $1 and ou.organization_id = $2
         and r.key = 'dispatcher' and r.is_system`,
      [USERS.ownerA, ORGS.a],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it("S14 · a tenant cannot assign another tenant's custom role", async () => {
    // The cross-tenant role-injection guard (threat T7). Set up a custom role in
    // org B, then try to attach it to a member of org A.
    const message = await expectDenied(
      USERS.ownerA,
      `with injected as (
         insert into roles (organization_id, key, name, is_system)
         values ($1, 'smuggled', 'Smuggled', false) returning id
       )
       insert into organization_user_roles (organization_user_id, role_id)
       select ou.id, injected.id from organization_users ou, injected
       where ou.user_id = $2 and ou.organization_id = $3`,
      [ORGS.b, USERS.plannerA, ORGS.a],
    );
    // Blocked at the policy layer: org A may not create a role inside org B.
    expect(message).toMatch(/row-level security|does not belong to organisation/i);
  });

  it('S14b · a tenant cannot edit a system role', async () => {
    const result = await asUser(
      USERS.ownerA,
      "update roles set name = 'Hijacked' where key = 'owner' and is_system",
    );
    expect(result.rowCount).toBe(0);
  });

  it('S14c · a tenant cannot add a permission to a system role', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      `insert into role_permissions (role_id, permission_key)
       select r.id, 'platform.settings.manage' from roles r
       where r.key = 'driver' and r.is_system`,
    );
    expect(message).toMatch(/row-level security/i);
  });
});

describe('S15–S16 · the audit trail is append-only', () => {
  it('S15 · ride_events cannot be updated', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      "update ride_events set event_type = 'COMPLETED' where ride_id = $1",
      [RIDES.janA],
    );
    expect(message).toMatch(/permission denied|append-only/i);
  });

  it('S15b · ride_events cannot be deleted', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      'delete from ride_events where ride_id = $1',
      [RIDES.janA],
    );
    expect(message).toMatch(/permission denied|append-only/i);
  });

  it('S15c · a second check-in event on the same ride is rejected', async () => {
    // Idempotency for double NFC taps (§60).
    await asUser(
      USERS.driverA1,
      `insert into ride_events (organization_id, ride_id, event_type, actor_kind, source)
       values ($1, $2, 'CLIENT_CHECKED_IN', 'DRIVER', 'NFC')`,
      [ORGS.a, RIDES.janA],
    );
    const message = await expectDenied(
      USERS.driverA1,
      `insert into ride_events (organization_id, ride_id, event_type, actor_kind, source)
       values ($1, $2, 'CLIENT_CHECKED_IN', 'DRIVER', 'NFC'),
              ($1, $2, 'CLIENT_CHECKED_IN', 'DRIVER', 'NFC')`,
      [ORGS.a, RIDES.janA],
    );
    expect(message).toMatch(/duplicate key|unique/i);
  });

  it('S16 · audit_logs cannot be deleted', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      'delete from audit_logs where organization_id = $1',
      [ORGS.a],
    );
    expect(message).toMatch(/permission denied|append-only/i);
  });

  it('S16b · audit_logs cannot be updated', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      "update audit_logs set action = 'nothing.happened' where organization_id = $1",
      [ORGS.a],
    );
    expect(message).toMatch(/permission denied|append-only/i);
  });

  it('S16c · a ride_event cannot be written into another tenant', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      `insert into ride_events (organization_id, ride_id, event_type, actor_kind, source)
       values ($1, $2, 'NOTE_ADDED', 'PLANNER', 'MANUAL')`,
      [ORGS.b, RIDES.klaasB],
    );
    expect(message).toMatch(/row-level security/i);
  });
});

describe('S17 · platform administrators (decision D-02)', () => {
  it('S17 · a platform admin cannot read tenant clients', async () => {
    expect(await countVisible(USERS.platformAdmin, 'clients')).toBe(0);
  });

  it('S17b · a platform admin cannot read tenant rides', async () => {
    expect(await countVisible(USERS.platformAdmin, 'rides')).toBe(0);
  });

  it('S17c · a platform admin cannot read ride events', async () => {
    expect(await countVisible(USERS.platformAdmin, 'ride_events')).toBe(0);
  });

  it('S17d · a platform admin CAN see organisation metadata', async () => {
    expect(await countVisible(USERS.platformAdmin, 'organizations')).toBe(2);
  });

  it('S17e · a platform admin cannot grant themselves support access', async () => {
    const message = await expectDenied(
      USERS.platformAdmin,
      `insert into support_access_grants (organization_id, granted_to_user_id,
                                          granted_by_user_id, reason, expires_at)
       values ($1, $2, $2, 'self service', now() + interval '4 hours')`,
      [ORGS.a, USERS.platformAdmin],
    );
    expect(message).toMatch(/row-level security/i);
  });
});

describe('S18 · anonymous access', () => {
  const tables = [
    'organizations',
    'clients',
    'rides',
    'ride_events',
    'drivers',
    'nfc_tags',
    'contacts',
    'audit_logs',
  ];

  it.each(tables)('S18 · anonymous users read nothing from %s', async (table) => {
    // anon holds no grants at all, so this is denied rather than empty. Either
    // outcome is acceptable; leaking a single row is not.
    let visible: number | null;
    try {
      visible = await countVisible(null, table);
    } catch {
      visible = null;
    }
    expect(visible === null || visible === 0).toBe(true);
  });

  it('S18b · a signed-in user with no membership sees nothing', async () => {
    expect(await countVisible(USERS.outsider, 'clients')).toBe(0);
    expect(await countVisible(USERS.outsider, 'rides')).toBe(0);
    expect(await countVisible(USERS.outsider, 'organizations')).toBe(0);
  });
});

describe('S19–S20 · tags', () => {
  it('S19 · a driver cannot query the tag table directly', async () => {
    // Check-in resolves a token through a server-side function instead
    // (docs/NFC.md §6), so the tag table stays staff-only.
    expect(await countVisible(USERS.driverA1, 'nfc_tags')).toBe(0);
  });

  it("S20 · org A cannot read org B's tag", async () => {
    expect(await countVisible(USERS.ownerA, 'nfc_tags', 'id = $1', [TAGS.klaasB])).toBe(
      0,
    );
  });

  it('S20b · org A can read its own tags', async () => {
    expect(await countVisible(USERS.ownerA, 'nfc_tags')).toBe(2);
  });

  it("S20c · org A cannot attach its tag to org B's client", async () => {
    const message = await expectDenied(
      USERS.ownerA,
      'update nfc_tags set client_id = $1 where id = $2',
      [CLIENTS.klaasB, TAGS.janA],
    );
    // Blocked by the foreign-key-plus-policy combination; either way, refused.
    expect(message.length).toBeGreaterThan(0);
  });
});

describe('S21 · revocation takes effect immediately', () => {
  it('S21 · an active planner can see the organisation’s clients', async () => {
    expect(await countVisible(USERS.plannerA, 'clients')).toBe(5);
  });

  it('S21b · suspending a member takes effect in the same session, with no JWT delay', async () => {
    // Decision D-04: membership is read live rather than from a token claim. A
    // claim would keep a dismissed employee working for up to an hour.
    const result = await setupThenRead<{ count: number }>(
      {
        sql: `update organization_users set status = 'SUSPENDED'
              where user_id = $1 and organization_id = $2`,
        params: [USERS.plannerA, ORGS.a],
      },
      { userId: USERS.plannerA, sql: 'select count(*)::int as count from clients' },
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it('S21c · suspending an organisation stops access for its members', async () => {
    const result = await setupThenRead<{ count: number }>(
      {
        sql: "update organizations set status = 'SUSPENDED' where id = $1",
        params: [ORGS.a],
      },
      { userId: USERS.ownerA, sql: 'select count(*)::int as count from clients' },
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it('S21d · soft-deleting an organisation stops access too', async () => {
    const result = await setupThenRead<{ count: number }>(
      {
        sql: 'update organizations set deleted_at = now() where id = $1',
        params: [ORGS.a],
      },
      { userId: USERS.ownerA, sql: 'select count(*)::int as count from rides' },
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it('S21e · revoking a care organisation link removes portal access', async () => {
    const result = await setupThenRead<{ count: number }>(
      {
        sql: `update client_care_organizations set valid_to = current_date - 1
              where client_id = $1`,
        params: [CLIENTS.janA],
      },
      { userId: USERS.careA, sql: 'select count(*)::int as count from clients' },
    );
    expect(result.rows[0]?.count).toBe(0);
  });

  it('S21f · revoking a contact link removes parent portal access', async () => {
    const result = await setupThenRead<{ count: number }>(
      {
        sql: 'update client_contacts set can_view_rides = false where client_id = $1',
        params: [CLIENTS.janA],
      },
      { userId: USERS.parentA, sql: 'select count(*)::int as count from clients' },
    );
    expect(result.rows[0]?.count).toBe(0);
  });
});
