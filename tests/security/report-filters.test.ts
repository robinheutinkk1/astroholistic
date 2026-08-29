import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminConnect, asUser, disconnect, expectDenied, ORGS, USERS } from './harness';

/**
 * Filteren op opdrachtgever en locatie.
 *
 * Een filter dat te veel doorlaat is hier geen schoonheidsfout: dan staan de
 * ritten van de ene opdrachtgever op de factuur van de andere. En een filter
 * dat de tenantgrens niet respecteert zou cijfers van een andere vervoerder
 * kunnen tonen.
 */

const HUMANKIND = '20000000-0000-4000-8000-0000000000e1';
const ANDERE = '20000000-0000-4000-8000-0000000000e2';

let humankindLocations: string[] = [];

beforeAll(async () => {
  const admin = await adminConnect();

  await admin.query(
    `insert into care_organizations (id, organization_id, name) values
       ($1, $3, 'Humankind'), ($2, $3, 'Andere Opdrachtgever')
     on conflict (id) do nothing`,
    [HUMANKIND, ANDERE, ORGS.a],
  );

  // Twee vestigingen onder Humankind, de rest blijft ongekoppeld.
  const picked = await admin.query<{ id: string }>(
    `update locations set care_organization_id = $1
     where id in (
       select id from locations
       where organization_id = $2 and deleted_at is null
       order by name limit 2
     )
     returning id`,
    [HUMANKIND, ORGS.a],
  );
  humankindLocations = picked.rows.map((row) => row.id);
  expect(humankindLocations.length).toBe(2);
});

afterAll(async () => {
  const admin = await adminConnect();
  await admin.query(
    'update locations set care_organization_id = null where care_organization_id in ($1, $2)',
    [HUMANKIND, ANDERE],
  );
  await admin.query('delete from care_organizations where id in ($1, $2)', [
    HUMANKIND,
    ANDERE,
  ]);
  await disconnect();
});

async function summaryTotal(
  user: string,
  careOrgId: string | null,
  locationId: string | null,
): Promise<number> {
  const result = await asUser<{ total: string }>(
    user,
    `select total from report_ride_summary($1::uuid, $2::date, $3::date, $4::uuid, $5::uuid)`,
    [ORGS.a, '2020-01-01', '2030-01-01', careOrgId, locationId],
  );
  return Number(result.rows[0]?.total ?? 0);
}

describe('het filter doet wat het belooft', () => {
  it('zonder filter telt alles, met filter minder', async () => {
    const all = await summaryTotal(USERS.ownerA, null, null);
    const filtered = await summaryTotal(USERS.ownerA, HUMANKIND, null);

    expect(all).toBeGreaterThan(0);
    expect(filtered).toBeGreaterThan(0);
    // De kern: het filter filtert echt. Zou het genegeerd worden, dan waren
    // deze twee gelijk en zou de test hierboven nog steeds slagen.
    expect(filtered).toBeLessThan(all);
  });

  it('een opdrachtgever zonder vestigingen levert nul ritten', async () => {
    expect(await summaryTotal(USERS.ownerA, ANDERE, null)).toBe(0);
  });

  it('een locatie telt de ritten van die ene vestiging', async () => {
    const perOrg = await summaryTotal(USERS.ownerA, HUMANKIND, null);
    const first = await summaryTotal(USERS.ownerA, null, humankindLocations[0]!);
    const second = await summaryTotal(USERS.ownerA, null, humankindLocations[1]!);

    expect(first).toBeGreaterThan(0);
    // Eén vestiging is nooit meer dan de hele opdrachtgever.
    expect(first).toBeLessThanOrEqual(perOrg);
    expect(second).toBeLessThanOrEqual(perOrg);
  });

  it('opdrachtgever én locatie samen werken als een en, niet als een of', async () => {
    /*
     * Zou dit een `or` zijn, dan levert een onmogelijke combinatie juist méér
     * op in plaats van niets, en ziet niemand dat het filter kapot is.
     */
    const combined = await summaryTotal(USERS.ownerA, ANDERE, humankindLocations[0]!);
    expect(combined).toBe(0);
  });

  it('een rit telt ook als de opdrachtgever alleen het ophaaladres is', async () => {
    // Het ophalen ná de dagbesteding is net zo goed een rit voor die
    // opdrachtgever. Zou alleen de bestemming tellen, dan verdwijnt de helft.
    const admin = await adminConnect();
    const asPickup = await admin.query<{ count: number }>(
      `select count(*)::int as count from rides
       where organization_id = $1 and pickup_location_id = any($2::uuid[])`,
      [ORGS.a, humankindLocations],
    );
    expect(asPickup.rows[0]!.count).toBeGreaterThan(0);

    const filtered = await summaryTotal(USERS.ownerA, HUMANKIND, null);
    expect(filtered).toBeGreaterThanOrEqual(asPickup.rows[0]!.count);
  });
});

describe('de tenantgrens', () => {
  it('een locatie kan niet naar de opdrachtgever van een andere vervoerder wijzen', async () => {
    const admin = await adminConnect();
    const careOrgB = await admin.query<{ id: string }>(
      'select id from care_organizations where organization_id = $1 limit 1',
      [ORGS.b],
    );

    const message = await expectDenied(
      USERS.ownerA,
      'update locations set care_organization_id = $1 where organization_id = $2',
      [careOrgB.rows[0]!.id, ORGS.a],
    );
    // De samengestelde foreign key uit migratie 0030 vangt dit, niet een
    // policy: de combinatie (organisatie, opdrachtgever) bestaat simpelweg niet.
    expect(message).toMatch(/foreign key|violates/i);
  });

  it('een vreemde opdrachtgever als filter levert nul, geen fout', async () => {
    // Een gekopieerde URL met het id van een andere vervoerder hoort een leeg
    // rapport te geven en niet een foutmelding die bevestigt dat het bestaat.
    const admin = await adminConnect();
    const careOrgB = await admin.query<{ id: string }>(
      'select id from care_organizations where organization_id = $1 limit 1',
      [ORGS.b],
    );

    expect(await summaryTotal(USERS.ownerA, careOrgB.rows[0]!.id, null)).toBe(0);
  });

  it('een chauffeur krijgt geen cijfers, met of zonder filter', async () => {
    expect(await summaryTotal(USERS.driverA1, null, null)).toBe(0);
    expect(await summaryTotal(USERS.driverA1, HUMANKIND, null)).toBe(0);
  });
});

describe('per locatie', () => {
  it('toont bij een gekozen opdrachtgever alleen diens vestigingen', async () => {
    /*
     * Elke rit raakt twee locaties. Zonder de extra regel in de functie zou
     * "Humankind, per locatie" ook alle woonadressen tonen waar die ritten
     * vandaan komen, en dat is een ander antwoord dan de vraag.
     */
    const result = await asUser<{ care_organization_id: string | null }>(
      USERS.ownerA,
      `select care_organization_id from report_by_location($1::uuid, $2::date, $3::date, $4::uuid)`,
      [ORGS.a, '2020-01-01', '2030-01-01', HUMANKIND],
    );

    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row.care_organization_id).toBe(HUMANKIND);
    }
  });

  it('zonder filter komen alle locaties terug, ook die zonder opdrachtgever', async () => {
    const result = await asUser<{ care_organization_id: string | null }>(
      USERS.ownerA,
      `select care_organization_id from report_by_location($1::uuid, $2::date, $3::date)`,
      [ORGS.a, '2020-01-01', '2030-01-01'],
    );

    expect(result.rows.some((row) => row.care_organization_id === null)).toBe(true);
    expect(result.rows.some((row) => row.care_organization_id === HUMANKIND)).toBe(true);
  });

  it('een chauffeur krijgt geen enkele regel', async () => {
    const result = await asUser(
      USERS.driverA1,
      `select location_id from report_by_location($1::uuid, $2::date, $3::date)`,
      [ORGS.a, '2020-01-01', '2030-01-01'],
    );
    expect(result.rowCount).toBe(0);
  });
});

describe('er is maar één versie van elke rapportagefunctie', () => {
  it('geen achtergebleven variant zonder filter', async () => {
    /*
     * `create or replace` met een extra parameter vervangt niets: het maakt een
     * tweede versie naast de oude. Een aanroep met drie argumenten zou dan de
     * ongefilterde versie treffen, en dat is precies de fout die je pas ontdekt
     * als een klant de cijfers van een ander op zijn factuur ziet.
     */
    const admin = await adminConnect();
    const result = await admin.query<{ proname: string; variants: number }>(
      `select p.proname, count(*)::int as variants
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'report\\_%'
       group by p.proname
       having count(*) > 1`,
    );
    expect(result.rows).toEqual([]);
  });
});
