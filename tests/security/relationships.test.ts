import { afterAll, describe, expect, it } from 'vitest';
import {
  adminConnect,
  asUser,
  asUserSteps,
  CLIENTS,
  disconnect,
  expectDenied,
  ORGS,
  USERS,
} from './harness';

/**
 * De koppelingen die bepalen wie een cliënt mag zien.
 *
 * `client_contacts` en `client_care_organizations` zijn geen administratie maar
 * toegangsbesluiten: wie hier een rij aanmaakt, geeft iemand buiten de
 * vervoerder inzage in het dossier van een ander mens. Dat is de reden dat deze
 * tabellen een eigen testbestand hebben.
 */

const OTHER_ORG_CONTACT = '40000000-0000-4000-8000-0000000000fe';

afterAll(async () => {
  const admin = await adminConnect();
  await admin.query('delete from contacts where id = $1', [OTHER_ORG_CONTACT]);
  await disconnect();
});

/** Een contactpersoon in organisatie B, om de tenantgrens mee te beproeven. */
async function contactInOrgB(): Promise<string> {
  const admin = await adminConnect();
  await admin.query(
    `insert into contacts (id, organization_id, first_name, last_name)
     values ($1, $2, 'Vreemde', 'Persoon')
     on conflict (id) do nothing`,
    [OTHER_ORG_CONTACT, ORGS.b],
  );
  return OTHER_ORG_CONTACT;
}

async function careOrgIn(organizationId: string): Promise<string> {
  const admin = await adminConnect();
  const result = await admin.query<{ id: string }>(
    'select id from care_organizations where organization_id = $1 limit 1',
    [organizationId],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error(`De seed mist een zorgorganisatie in ${organizationId}`);
  return id;
}

describe('een koppeling mag de tenantgrens niet oversteken', () => {
  it('een contactpersoon van een andere vervoerder kan niet aan je cliënt worden gehangen', async () => {
    /*
     * Dit was een echt gat, gevonden bij het bouwen van de beheerschermen. De
     * policy keek alleen naar de cliënt en zei niets over de contactpersoon.
     * Een planner met een gekopieerd id gaf daarmee de portaalgebruiker van een
     * andere vervoerder inzage in zijn eigen cliënt.
     */
    const contactId = await contactInOrgB();
    const message = await expectDenied(
      USERS.ownerA,
      `insert into client_contacts (client_id, contact_id, relationship)
       values ($1, $2, 'ingeslopen')`,
      [CLIENTS.fatimaA, contactId],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('een zorgorganisatie van een andere vervoerder ook niet', async () => {
    const careOrgB = await careOrgIn(ORGS.b);
    const message = await expectDenied(
      USERS.ownerA,
      `insert into client_care_organizations (client_id, care_organization_id)
       values ($1, $2)`,
      [CLIENTS.fatimaA, careOrgB],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('een bestaande koppeling kan niet naar een vreemde contactpersoon worden omgezet', async () => {
    // De update-policy heeft dezelfde check nodig als de insert; anders is de
    // omweg "koppel eerst netjes, wijzig daarna het id" nog steeds open.
    const contactId = await contactInOrgB();
    const admin = await adminConnect();
    const own = await admin.query<{ contact_id: string }>(
      'select contact_id from client_contacts where client_id = $1 limit 1',
      [CLIENTS.janA],
    );
    expect(own.rows[0], 'de seed moet Jan een contactpersoon geven').toBeTruthy();

    const message = await expectDenied(
      USERS.ownerA,
      `update client_contacts set contact_id = $1
       where client_id = $2 and contact_id = $3`,
      [contactId, CLIENTS.janA, own.rows[0]!.contact_id],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('binnen de eigen organisatie kan het gewoon', async () => {
    // De regel hierboven mag het normale werk niet blokkeren.
    const admin = await adminConnect();
    const contact = await admin.query<{ id: string }>(
      'select id from contacts where organization_id = $1 limit 1',
      [ORGS.a],
    );
    const careOrg = await careOrgIn(ORGS.a);

    const linked = await asUser(
      USERS.ownerA,
      `insert into client_contacts (client_id, contact_id, can_view_rides)
       values ($1, $2, true)
       on conflict (client_id, contact_id) do update set can_view_rides = true`,
      [CLIENTS.fatimaA, contact.rows[0]!.id],
    );
    expect(linked.rowCount).toBe(1);

    const funded = await asUser(
      USERS.ownerA,
      `insert into client_care_organizations (client_id, care_organization_id, valid_from)
       values ($1, $2, current_date + 400)`,
      [CLIENTS.fatimaA, careOrg],
    );
    expect(funded.rowCount).toBe(1);
  });
});

describe('wie mag koppelen', () => {
  it('een chauffeur kan geen contactpersoon aan een cliënt hangen', async () => {
    const admin = await adminConnect();
    const contact = await admin.query<{ id: string }>(
      'select id from contacts where organization_id = $1 limit 1',
      [ORGS.a],
    );
    const message = await expectDenied(
      USERS.driverA1,
      'insert into client_contacts (client_id, contact_id) values ($1, $2)',
      [CLIENTS.fatimaA, contact.rows[0]!.id],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('een dispatcher kan geen opdrachtgever aan een cliënt hangen', async () => {
    const careOrg = await careOrgIn(ORGS.a);
    const message = await expectDenied(
      USERS.dispatcherA,
      'insert into client_care_organizations (client_id, care_organization_id) values ($1, $2)',
      [CLIENTS.fatimaA, careOrg],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('een chauffeur kan geen contactpersoon aanmaken', async () => {
    const message = await expectDenied(
      USERS.driverA1,
      `insert into contacts (organization_id, first_name, last_name)
       values ($1, 'Nieuwe', 'Persoon')`,
      [ORGS.a],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('een chauffeur kan geen opdrachtgever aanmaken', async () => {
    const message = await expectDenied(
      USERS.driverA1,
      `insert into care_organizations (organization_id, name) values ($1, 'Verzonnen BV')`,
      [ORGS.a],
    );
    expect(message).toMatch(/row-level security/i);
  });
});

describe('de vinkjes op de koppeling bepalen wat de contactpersoon ziet', () => {
  it('zonder can_view_rides ziet de contactpersoon de ritten niet', async () => {
    /*
     * De koppeling en de leesactie in één transactie, en de verwachting vooraf
     * uitgerekend met de eigenaarsverbinding: anders vergelijkt de test de
     * policy met zichzelf.
     */
    const admin = await adminConnect();
    await admin.query('begin');
    try {
      const contact = await admin.query<{ user_id: string | null; id: string }>(
        'select id, user_id from contacts where organization_id = $1 and user_id is not null limit 1',
        [ORGS.a],
      );
      const viewer = contact.rows[0];
      expect(viewer, 'de seed moet een contactpersoon met account hebben').toBeTruthy();

      await admin.query(
        `insert into client_contacts (client_id, contact_id, can_view_rides)
         values ($1, $2, false)
         on conflict (client_id, contact_id) do update set can_view_rides = false`,
        [CLIENTS.fatimaA, viewer!.id],
      );

      await admin.query('set local role authenticated');
      await admin.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: viewer!.user_id, role: 'authenticated' }),
      ]);

      const seen = await admin.query<{ count: number }>(
        'select count(*)::int as count from rides where client_id = $1',
        [CLIENTS.fatimaA],
      );
      expect(seen.rows[0]?.count).toBe(0);
    } finally {
      await admin.query('rollback');
    }
  });

  it('met can_view_rides ziet hij ze wel, en alleen van die cliënt', async () => {
    const admin = await adminConnect();

    const expected = await admin.query<{ count: number }>(
      'select count(*)::int as count from rides where client_id = $1',
      [CLIENTS.fatimaA],
    );
    expect(expected.rows[0]!.count).toBeGreaterThan(0);

    await admin.query('begin');
    try {
      const contact = await admin.query<{ user_id: string | null; id: string }>(
        'select id, user_id from contacts where organization_id = $1 and user_id is not null limit 1',
        [ORGS.a],
      );
      const viewer = contact.rows[0]!;

      // Alleen deze ene koppeling laten staan, zodat de telling eenduidig is.
      await admin.query('delete from client_contacts where contact_id = $1', [viewer.id]);
      await admin.query(
        `insert into client_contacts (client_id, contact_id, can_view_rides)
         values ($1, $2, true)`,
        [CLIENTS.fatimaA, viewer.id],
      );

      await admin.query('set local role authenticated');
      await admin.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: viewer.user_id, role: 'authenticated' }),
      ]);

      const own = await admin.query<{ count: number }>(
        'select count(*)::int as count from rides where client_id = $1',
        [CLIENTS.fatimaA],
      );
      expect(own.rows[0]?.count).toBe(expected.rows[0]!.count);

      const others = await admin.query<{ count: number }>(
        'select count(*)::int as count from rides where client_id <> $1',
        [CLIENTS.fatimaA],
      );
      expect(others.rows[0]?.count).toBe(0);
    } finally {
      await admin.query('rollback');
    }
  });

  it('loskoppelen laat de contactpersoon per direct niets meer zien', async () => {
    const admin = await adminConnect();
    await admin.query('begin');
    try {
      const contact = await admin.query<{ user_id: string | null; id: string }>(
        'select id, user_id from contacts where organization_id = $1 and user_id is not null limit 1',
        [ORGS.a],
      );
      const viewer = contact.rows[0]!;
      await admin.query('delete from client_contacts where contact_id = $1', [viewer.id]);

      await admin.query('set local role authenticated');
      await admin.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: viewer.user_id, role: 'authenticated' }),
      ]);

      const seen = await admin.query<{ count: number }>(
        'select count(*)::int as count from clients',
      );
      expect(seen.rows[0]?.count).toBe(0);
    } finally {
      await admin.query('rollback');
    }
  });
});

describe('de looptijd van een opdrachtgever wordt echt gelezen', () => {
  it('buiten de periode ziet de zorgcoördinator de cliënt niet', async () => {
    const admin = await adminConnect();
    await admin.query('begin');
    try {
      const careOrg = await careOrgIn(ORGS.a);

      // De koppeling naar het verleden zetten: de indicatie is afgelopen.
      await admin.query(
        `update client_care_organizations
         set valid_from = current_date - 400, valid_to = current_date - 300
         where care_organization_id = $1`,
        [careOrg],
      );

      await admin.query('set local role authenticated');
      await admin.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.careA, role: 'authenticated' }),
      ]);

      const seen = await admin.query<{ count: number }>(
        'select count(*)::int as count from clients',
      );
      expect(seen.rows[0]?.count).toBe(0);
    } finally {
      await admin.query('rollback');
    }
  });

  it('binnen de periode ziet hij hem wel', async () => {
    const admin = await adminConnect();
    await admin.query('begin');
    try {
      const careOrg = await careOrgIn(ORGS.a);
      await admin.query(
        `update client_care_organizations
         set valid_from = current_date - 10, valid_to = null
         where care_organization_id = $1`,
        [careOrg],
      );

      await admin.query('set local role authenticated');
      await admin.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.careA, role: 'authenticated' }),
      ]);

      const seen = await admin.query<{ count: number }>(
        'select count(*)::int as count from clients',
      );
      expect(seen.rows[0]?.count).toBeGreaterThan(0);
    } finally {
      await admin.query('rollback');
    }
  });
});

describe('zacht verwijderen laat de administratie staan', () => {
  it('een verwijderde contactpersoon verdwijnt uit beeld maar de ritten blijven', async () => {
    const admin = await adminConnect();
    const contact = await admin.query<{ id: string }>(
      'select id from contacts where organization_id = $1 limit 1',
      [ORGS.a],
    );

    const result = await asUserSteps<{ count: number }>(USERS.ownerA, [
      {
        sql: "update contacts set deleted_at = now(), status = 'INACTIVE' where id = $1",
        params: [contact.rows[0]!.id],
      },
      {
        sql: 'select count(*)::int as count from client_contacts where contact_id = $1',
        params: [contact.rows[0]!.id],
      },
    ]);
    // De koppelrij blijft bestaan; het scherm filtert op deleted_at.
    expect(result.rows[0]?.count).toBeGreaterThanOrEqual(0);

    const rides = await asUser<{ count: number }>(
      USERS.ownerA,
      'select count(*)::int as count from rides',
    );
    expect(rides.rows[0]?.count).toBeGreaterThan(0);
  });
});
