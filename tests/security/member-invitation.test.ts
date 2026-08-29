import { afterAll, describe, expect, it } from 'vitest';
import {
  adminConnect,
  asUser,
  asUserSteps,
  asServiceRoleSteps,
  disconnect,
  expectDenied,
  expectDeniedSteps,
  ORGS,
  USERS,
} from './harness';

/**
 * Uitnodigen is de enige plek waar een tenant iemand toegang geeft die er nog
 * niet was. Alles wat hier misgaat is een vreemde in de organisatie, dus de
 * grens ligt in de database en niet in het formulier.
 */

/*
 * De losse accounts hieronder worden met de eigenaarsverbinding gemaakt en
 * worden dus niet teruggedraaid zoals de asserties dat wel worden. Ze dragen
 * allemaal hetzelfde e-maildomein, zodat ze aan het eind in één keer weg
 * kunnen en de volgende run een schone database vindt.
 */
const TEST_EMAIL_DOMAIN = '@uitnodiging.test';

afterAll(async () => {
  const admin = await adminConnect();
  await admin.query('delete from auth.users where email like $1', [
    `%${TEST_EMAIL_DOMAIN}`,
  ]);
  await admin.query("delete from roles where key like 'ledenbeheer-%'");
  await disconnect();
});

let sequence = 0;
function uniqueEmail(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}${TEST_EMAIL_DOMAIN}`;
}

async function roleId(key: string): Promise<string> {
  const admin = await adminConnect();
  const result = await admin.query<{ id: string }>(
    'select id from roles where key = $1 and is_system',
    [key],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error(`Systeemrol ${key} ontbreekt in de seed`);
  return id;
}

/** Maakt een los auth-account waar nog geen lidmaatschap aan hangt. */
async function createLooseAccount(email: string): Promise<string> {
  const admin = await adminConnect();
  const result = await admin.query<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [email],
  );
  return result.rows[0]!.id;
}

describe('een account krijgt automatisch een profiel', () => {
  it('een nieuwe auth-gebruiker levert een profielrij op', async () => {
    // Zonder dit werkt uitnodigen niet: de applicatie herkent een bestaand
    // account aan `profiles`, en een lidmaatschap verwijst naar profiles.id.
    const email = uniqueEmail('trigger');
    const userId = await createLooseAccount(email);

    const admin = await adminConnect();
    const profile = await admin.query<{ email: string }>(
      'select email from profiles where id = $1',
      [userId],
    );
    expect(profile.rows[0]?.email).toBe(email);
  });

  it('de naam uit de metadata komt mee, en anders blijft hij leeg', async () => {
    const admin = await adminConnect();
    const withName = await admin.query<{ id: string }>(
      `insert into auth.users (id, email, raw_user_meta_data)
       values (gen_random_uuid(), $1, '{"full_name": "Sanne de Vries"}'::jsonb)
       returning id`,
      [uniqueEmail('meta')],
    );
    const profile = await admin.query<{ full_name: string | null }>(
      'select full_name from profiles where id = $1',
      [withName.rows[0]!.id],
    );
    expect(profile.rows[0]?.full_name).toBe('Sanne de Vries');
  });
});

describe('wie mag iemand toevoegen', () => {
  it('een eigenaar kan een lidmaatschap aanmaken en er een rol aan hangen', async () => {
    const userId = await createLooseAccount(uniqueEmail('nieuw'));
    const driverRole = await roleId('driver');

    /*
     * Beide stappen in één transactie. Los van elkaar zou de eerste worden
     * teruggedraaid voordat de tweede begint, en dan bewijst de tweede niets:
     * het lidmaatschap waar de rol aan moet hangen bestaat dan niet meer.
     */
    const granted = await asUserSteps<{ id: string }>(USERS.ownerA, [
      {
        sql: `insert into organization_users (organization_id, user_id, status, invited_by, invited_at)
              values ($1, $2, 'INVITED', $3, now())`,
        params: [ORGS.a, userId, USERS.ownerA],
      },
      {
        sql: `insert into organization_user_roles (organization_user_id, role_id, granted_by)
              select ou.id, $2, $3 from organization_users ou
              where ou.organization_id = $1 and ou.user_id = $4
              returning organization_user_id as id`,
        params: [ORGS.a, driverRole, USERS.ownerA, userId],
      },
    ]);
    expect(granted.rowCount).toBe(1);
  });

  it('een dispatcher kan niemand toevoegen', async () => {
    // Dispatcher ziet de hele planning maar beheert geen leden. Zou dit lukken,
    // dan kon iedere dispatcher zichzelf collega's toewijzen.
    const userId = await createLooseAccount(uniqueEmail('dispatch'));
    const message = await expectDenied(
      USERS.dispatcherA,
      `insert into organization_users (organization_id, user_id, status)
       values ($1, $2, 'INVITED')`,
      [ORGS.a, userId],
    );
    expect(message).toMatch(/row-level security/i);
  });

  it('een eigenaar van organisatie B kan niemand in organisatie A zetten', async () => {
    const userId = await createLooseAccount(uniqueEmail('kruis'));
    const message = await expectDenied(
      USERS.ownerB,
      `insert into organization_users (organization_id, user_id, status)
       values ($1, $2, 'INVITED')`,
      [ORGS.a, userId],
    );
    expect(message).toMatch(/row-level security/i);
  });
});

describe('rollen toekennen bij het uitnodigen', () => {
  it('zonder organization.roles.manage komt er geen rol op het nieuwe lid', async () => {
    /*
     * Dit is het gat dat de dienstlaag dicht moet houden. Iemand die alleen
     * leden mag beheren zou anders via een uitnodiging alsnog rollen uitdelen.
     * De policy op organization_user_roles is de laatste grens.
     */
    const userId = await createLooseAccount(uniqueEmail('geenrol'));
    const admin = await adminConnect();

    // Een rol die leden beheert maar geen rollen beheert bestaat niet als
    // systeemrol, dus die wordt hier gemaakt: dit is precies het scenario.
    const custom = await admin.query<{ id: string }>(
      `insert into roles (organization_id, key, name, description)
       values ($1, 'ledenbeheer-' || floor(random() * 1000000)::text, 'Ledenbeheer', 'Alleen leden')
       returning id`,
      [ORGS.a],
    );
    const customRoleId = custom.rows[0]!.id;
    await admin.query(
      `insert into role_permissions (role_id, permission_key) values
        ($1, 'organization.members.view'),
        ($1, 'organization.members.manage'),
        ($1, 'organization.roles.view')`,
      [customRoleId],
    );

    const actorId = await createLooseAccount(uniqueEmail('beheerder'));
    const actorMembership = await admin.query<{ id: string }>(
      `insert into organization_users (organization_id, user_id, status, joined_at)
       values ($1, $2, 'ACTIVE', now()) returning id`,
      [ORGS.a, actorId],
    );
    await admin.query(
      'insert into organization_user_roles (organization_user_id, role_id) values ($1, $2)',
      [actorMembership.rows[0]!.id, customRoleId],
    );

    const driverRole = await roleId('driver');

    /*
     * Allebei de stappen in dezelfde transactie, en de rol wordt aan het
     * lidmaatschap gehangen via een select in plaats van via een id uit een
     * vorige aanroep. Anders bestaat dat lidmaatschap niet meer op het moment
     * dat de tweede stap draait, wordt de rij door de `exists` gemist, en
     * slaagt de test terwijl de policy is doorgeknipt.
     */
    const message = await expectDeniedSteps(actorId, [
      {
        sql: `insert into organization_users (organization_id, user_id, status)
              values ($1, $2, 'INVITED')`,
        params: [ORGS.a, userId],
      },
      {
        sql: `insert into organization_user_roles (organization_user_id, role_id)
              select ou.id, $2 from organization_users ou
              where ou.organization_id = $1 and ou.user_id = $3`,
        params: [ORGS.a, driverRole, userId],
      },
    ]);
    expect(message).toMatch(/row-level security/i);

    // En het lidmaatschap zelf mocht hij wél aanmaken: de weigering hierboven
    // gaat over de rol, niet over het lid.
    const membership = await asUser(
      actorId,
      `insert into organization_users (organization_id, user_id, status)
       values ($1, $2, 'INVITED')`,
      [ORGS.a, userId],
    );
    expect(membership.rowCount).toBe(1);
  });

  it('niemand kan zijn eigen rollen uitbreiden', async () => {
    const admin = await adminConnect();
    const ownRow = await admin.query<{ id: string }>(
      'select id from organization_users where organization_id = $1 and user_id = $2',
      [ORGS.a, USERS.ownerA],
    );
    const adminRole = await roleId('admin');

    const message = await expectDenied(
      USERS.ownerA,
      `insert into organization_user_roles (organization_user_id, role_id)
       values ($1, $2)`,
      [ownRow.rows[0]!.id, adminRole],
    );
    expect(message).toMatch(/row-level security/i);
  });
});

describe('het uitnodigen zelf laat een spoor na', () => {
  it('een uitgenodigd lid staat op INVITED en heeft nog geen joined_at', async () => {
    const userId = await createLooseAccount(uniqueEmail('spoor'));
    const row = await asUser<{ status: string; joined_at: string | null }>(
      USERS.ownerA,
      `insert into organization_users (organization_id, user_id, status, invited_by, invited_at)
       values ($1, $2, 'INVITED', $3, now())
       returning status, joined_at`,
      [ORGS.a, userId, USERS.ownerA],
    );
    expect(row.rows[0]?.status).toBe('INVITED');
    expect(row.rows[0]?.joined_at).toBeNull();
  });

  it('dezelfde persoon kan niet twee keer in dezelfde organisatie zitten', async () => {
    const userId = await createLooseAccount(uniqueEmail('dubbel'));
    const insert = {
      sql: `insert into organization_users (organization_id, user_id, status)
            values ($1, $2, 'INVITED')`,
      params: [ORGS.a, userId],
    };

    // Twee keer op "uitnodigen" klikken mag geen tweede lidmaatschap opleveren;
    // de dienstlaag hergebruikt daarom het bestaande. Dit bewijst dat de
    // database dat afdwingt en niet alleen de code.
    const message = await expectDeniedSteps(USERS.ownerA, [insert, insert]);
    expect(message).toMatch(/duplicate key|unique/i);
  });

  it('de uitnodiging staat in het auditlogboek en is niet te wissen', async () => {
    const userId = await createLooseAccount(uniqueEmail('audit'));

    const logged = await asUserSteps<{ action: string }>(USERS.ownerA, [
      {
        sql: `insert into organization_users (organization_id, user_id, status)
              values ($1, $2, 'INVITED')`,
        params: [ORGS.a, userId],
      },
      {
        sql: `insert into audit_logs (organization_id, actor_user_id, actor_kind, action, entity_type, entity_id)
              select $1, $2, 'PLANNER', 'member.invited', 'organization_users', ou.id
              from organization_users ou
              where ou.organization_id = $1 and ou.user_id = $3
              returning action`,
        params: [ORGS.a, USERS.ownerA, userId],
      },
    ]);
    expect(logged.rows[0]?.action).toBe('member.invited');

    // Het logboek is append-only, en dat zit in de rechten en niet in een
    // policy: `authenticated` heeft simpelweg geen delete op deze tabel.
    const message = await expectDenied(
      USERS.ownerA,
      'delete from audit_logs where organization_id = $1',
      [ORGS.a],
    );
    expect(message).toMatch(/permission denied/i);
  });
});

describe('de service-role-taak van het uitnodigen', () => {
  it('een tenant kan zelf niet in auth.users kijken om te zien of iemand bestaat', async () => {
    // De applicatie doet die lookup via profiles, met de service role. Een
    // ingelogde gebruiker mag dat nooit rechtstreeks kunnen.
    const message = await expectDenied(
      USERS.ownerA,
      'select id from auth.users limit 1',
      [],
    );
    expect(message).toMatch(/permission denied|does not exist/i);
  });

  it('een profiel van iemand buiten je organisatie blijft onzichtbaar', async () => {
    const outsiderEmail = uniqueEmail('onzichtbaar');
    await createLooseAccount(outsiderEmail);

    const seen = await asUser<{ count: number }>(
      USERS.ownerA,
      'select count(*)::int as count from profiles where email = $1',
      [outsiderEmail],
    );
    expect(seen.rows[0]?.count).toBe(0);
  });

  it('de service role ziet dat profiel wel, want anders kan hij niet uitnodigen', async () => {
    const email = uniqueEmail('zichtbaar');
    await createLooseAccount(email);

    const result = await asServiceRoleSteps<{ count: number }>([
      {
        sql: 'select count(*)::int as count from profiles where email = $1',
        params: [email],
      },
    ]);
    expect(result.rows[0]?.count).toBe(1);
  });
});
