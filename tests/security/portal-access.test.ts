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
 * Portaaltoegang uitdelen: de kant van de planner.
 *
 * Dit is de gevaarlijkste knop in het product. Hij koppelt een inlogaccount aan
 * een dossier, en één verkeerde koppeling betekent dat een vreemde de ritten
 * van een kind kan meelezen. De grens ligt daarom in de database, niet in het
 * formulier dat de koppeling maakt.
 */

const TEST_EMAIL_DOMAIN = '@portaaltoegang.test';

afterAll(async () => {
  const admin = await adminConnect();
  await admin.query('delete from auth.users where email like $1', [
    `%${TEST_EMAIL_DOMAIN}`,
  ]);
  await disconnect();
});

let sequence = 0;
async function looseAccount(prefix: string): Promise<string> {
  sequence += 1;
  const admin = await adminConnect();
  const result = await admin.query<{ id: string }>(
    'insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id',
    [`${prefix}-${Date.now()}-${sequence}${TEST_EMAIL_DOMAIN}`],
  );
  return result.rows[0]!.id;
}

describe('een account aan een cliënt koppelen', () => {
  it('een planner kan een cliënt van de eigen organisatie portaaltoegang geven', async () => {
    const userId = await looseAccount('portaal');
    const result = await asUser(
      USERS.plannerA,
      'update clients set user_id = $1 where id = $2 and user_id is null',
      [userId, CLIENTS.fatimaA],
    );
    expect(result.rowCount).toBe(1);
  });

  it('een planner van B kan geen account aan een cliënt van A hangen', async () => {
    // Zou dit lukken, dan gaf een vreemde vervoerder iemand toegang tot het
    // dossier van een cliënt die niet van hem is.
    const userId = await looseAccount('kruis');
    const result = await asUser(
      USERS.ownerB,
      'update clients set user_id = $1 where id = $2',
      [userId, CLIENTS.fatimaA],
    );
    expect(result.rowCount).toBe(0);
  });

  it('een chauffeur kan niemand portaaltoegang geven', async () => {
    const userId = await looseAccount('chauffeur');
    const result = await asUser(
      USERS.driverA1,
      'update clients set user_id = $1 where id = $2',
      [userId, CLIENTS.fatimaA],
    );
    expect(result.rowCount).toBe(0);
  });
});

describe('wat de gekoppelde persoon te zien krijgt', () => {
  it('hij ziet zijn eigen cliëntdossier en verder geen enkel ander', async () => {
    const userId = await looseAccount('inzage');

    const visible = await asUserSteps<{ id: string }>(USERS.ownerA, [
      {
        sql: 'update clients set user_id = $1 where id = $2',
        params: [userId, CLIENTS.fatimaA],
      },
    ]);
    expect(visible.rowCount).toBe(1);

    /*
     * De koppeling en de leesactie moeten in dezelfde transactie, anders is de
     * koppeling teruggedraaid voordat de portaalgebruiker kijkt en ziet hij
     * niets — waarna de test slaagt terwijl er niets is bewezen.
     *
     * Daarom wordt hieronder binnen één transactie van rol gewisseld. `set
     * local role` mag heen en weer zolang de buitenste rol dat toestaat.
     */
    const admin = await adminConnect();
    await admin.query('begin');
    try {
      await admin.query('update clients set user_id = $1 where id = $2', [
        userId,
        CLIENTS.fatimaA,
      ]);
      await admin.query('set local role authenticated');
      await admin.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);

      const seen = await admin.query<{ id: string }>('select id from clients');
      expect(seen.rows.map((row) => row.id)).toEqual([CLIENTS.fatimaA]);

      // En geen enkele rit van een andere cliënt.
      const rides = await admin.query<{ count: number }>(
        `select count(*)::int as count from rides where client_id <> $1`,
        [CLIENTS.fatimaA],
      );
      expect(rides.rows[0]?.count).toBe(0);
    } finally {
      await admin.query('rollback');
    }
  });

  it('een portaalgebruiker is geen lid en heeft dus geen enkele permissie', async () => {
    const userId = await looseAccount('geenlid');
    const admin = await adminConnect();

    /*
     * Eerst uitrekenen wat het antwoord hoort te zijn, met de eigenaars-
     * verbinding en dus zonder RLS. Dezelfde vraag stellen ná het wisselen naar
     * de portaalrol zou de policy met zichzelf vergelijken: dan klopt het
     * antwoord altijd, ook als de policy openstaat.
     */
    const expected = await admin.query<{ id: string }>(
      `select distinct l.id from locations l
       join rides r on r.pickup_location_id = l.id or r.destination_location_id = l.id
       where r.client_id = $1`,
      [CLIENTS.fatimaA],
    );
    const expectedLocations = new Set(expected.rows.map((row) => row.id));
    const total = await admin.query<{ count: number }>(
      'select count(*)::int as count from locations where organization_id = $1',
      [ORGS.a],
    );
    const totalLocations = total.rows[0]!.count;

    await admin.query('begin');
    try {
      await admin.query('update clients set user_id = $1 where id = $2', [
        userId,
        CLIENTS.fatimaA,
      ]);
      await admin.query('set local role authenticated');
      await admin.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);

      const perms = await admin.query<{ ids: string[] }>(
        "select app.permitted_org_ids('clients.view') as ids",
      );
      expect(perms.rows[0]?.ids).toEqual([]);

      // Geen chauffeurs, geen voertuigen, geen ledenlijst.
      for (const table of ['drivers', 'vehicles', 'organization_users']) {
        const rows = await admin.query<{ count: number }>(
          `select count(*)::int as count from ${table}`,
        );
        expect(rows.rows[0]?.count, `${table} moet leeg zijn`).toBe(0);
      }

      /*
       * Locaties zijn de uitzondering, en bewust: wie zijn eigen rit ziet moet
       * ook kunnen zien waar hij wordt opgehaald. Zichtbaar zijn dus alleen de
       * adressen die op zijn eigen ritten staan — het adressenboek van de
       * vervoerder blijft dicht.
       */
      const locations = await admin.query<{ id: string }>('select id from locations');
      expect(locations.rows.length).toBeGreaterThan(0);
      expect(new Set(locations.rows.map((row) => row.id))).toEqual(expectedLocations);
      // En dat is minder dan wat de organisatie zelf heeft staan.
      expect(locations.rows.length).toBeLessThan(totalLocations);
    } finally {
      await admin.query('rollback');
    }
  });
});

describe('zien wie er toegang heeft', () => {
  it('de planner ziet het e-mailadres van de gekoppelde portaalgebruiker', async () => {
    // Zonder dit kan het scherm alleen "heeft toegang" tonen en nooit wie, en
    // dat is voor de verwerkingsverantwoordelijke niet genoeg.
    const userId = await looseAccount('zichtbaar');
    const found = await asUserSteps<{ email: string }>(USERS.ownerA, [
      {
        sql: 'update clients set user_id = $1 where id = $2',
        params: [userId, CLIENTS.fatimaA],
      },
      { sql: 'select email from profiles where id = $1', params: [userId] },
    ]);
    expect(found.rows[0]?.email).toMatch(new RegExp(`${TEST_EMAIL_DOMAIN}$`));
  });

  it('een profiel dat aan niets hangt blijft onzichtbaar', async () => {
    const userId = await looseAccount('losstaand');
    const found = await asUser<{ count: number }>(
      USERS.ownerA,
      'select count(*)::int as count from profiles where id = $1',
      [userId],
    );
    expect(found.rows[0]?.count).toBe(0);
  });

  it('een organisatie ziet de portaalgebruiker van een andere organisatie niet', async () => {
    const userId = await looseAccount('vanA');
    const admin = await adminConnect();
    await admin.query('begin');
    try {
      await admin.query('update clients set user_id = $1 where id = $2', [
        userId,
        CLIENTS.fatimaA,
      ]);
      await admin.query('set local role authenticated');
      await admin.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.ownerB, role: 'authenticated' }),
      ]);

      const seen = await admin.query<{ count: number }>(
        'select count(*)::int as count from profiles where id = $1',
        [userId],
      );
      expect(seen.rows[0]?.count).toBe(0);
    } finally {
      await admin.query('rollback');
    }
  });

  it('een chauffeur ziet die profielen niet, want hij mag geen cliënten inzien', async () => {
    const userId = await looseAccount('chauffeurblind');
    const admin = await adminConnect();
    await admin.query('begin');
    try {
      await admin.query('update clients set user_id = $1 where id = $2', [
        userId,
        CLIENTS.fatimaA,
      ]);
      await admin.query('set local role authenticated');
      await admin.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: USERS.driverA1, role: 'authenticated' }),
      ]);

      const seen = await admin.query<{ count: number }>(
        'select count(*)::int as count from profiles where id = $1',
        [userId],
      );
      expect(seen.rows[0]?.count).toBe(0);
    } finally {
      await admin.query('rollback');
    }
  });
});

describe('toegang van een zorgorganisatie', () => {
  it('alleen wie zorgorganisaties beheert kan er een medewerker aan hangen', async () => {
    const userId = await looseAccount('zorg');
    const admin = await adminConnect();
    const careOrg = await admin.query<{ id: string }>(
      'select id from care_organizations where organization_id = $1 limit 1',
      [ORGS.a],
    );
    const careOrgId = careOrg.rows[0]?.id;
    expect(careOrgId, 'de seed moet een zorgorganisatie in A hebben').toBeTruthy();

    const allowed = await asUser(
      USERS.ownerA,
      'insert into care_organization_users (care_organization_id, user_id) values ($1, $2)',
      [careOrgId, userId],
    );
    expect(allowed.rowCount).toBe(1);

    const message = await expectDenied(
      USERS.dispatcherA,
      'insert into care_organization_users (care_organization_id, user_id) values ($1, $2)',
      [careOrgId, userId],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('een vervoerder kan geen medewerker hangen aan de zorgorganisatie van een ander', async () => {
    const userId = await looseAccount('zorgkruis');
    const admin = await adminConnect();
    const careOrg = await admin.query<{ id: string }>(
      'select id from care_organizations where organization_id = $1 limit 1',
      [ORGS.a],
    );

    const message = await expectDenied(
      USERS.ownerB,
      'insert into care_organization_users (care_organization_id, user_id) values ($1, $2)',
      [careOrg.rows[0]!.id, userId],
    );
    expect(message).toMatch(/row-level security/i);
  });
});

describe('intrekken werkt onmiddellijk', () => {
  it('na het loskoppelen ziet de portaalgebruiker niets meer', async () => {
    const userId = await looseAccount('intrekken');
    const admin = await adminConnect();
    await admin.query('begin');
    try {
      await admin.query('update clients set user_id = $1 where id = $2', [
        userId,
        CLIENTS.fatimaA,
      ]);
      await admin.query('update clients set user_id = null where id = $1', [
        CLIENTS.fatimaA,
      ]);
      await admin.query('set local role authenticated');
      await admin.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);

      const seen = await admin.query<{ count: number }>(
        'select count(*)::int as count from clients',
      );
      expect(seen.rows[0]?.count).toBe(0);
    } finally {
      await admin.query('rollback');
    }
  });

  it('een portaalgebruiker kan zichzelf niet aan een tweede cliënt koppelen', async () => {
    // Hij mag `clients` lezen voor zijn eigen dossier. Schrijven hoort daar niet
    // bij: dan koppelde hij zichzelf aan het dossier van de buurman.
    const userId = await looseAccount('zelfkoppel');
    const admin = await adminConnect();
    await admin.query('begin');
    try {
      await admin.query('update clients set user_id = $1 where id = $2', [
        userId,
        CLIENTS.fatimaA,
      ]);
      await admin.query('set local role authenticated');
      await admin.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);

      const attempt = await admin.query('update clients set user_id = $1 where id = $2', [
        userId,
        CLIENTS.janA,
      ]);
      expect(attempt.rowCount).toBe(0);
    } finally {
      await admin.query('rollback');
    }
  });
});
