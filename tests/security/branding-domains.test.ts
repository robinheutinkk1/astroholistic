import { afterAll, describe, expect, it } from 'vitest';
import {
  ORGS,
  USERS,
  asServiceRole,
  asServiceRoleSteps,
  asUser,
  countVisible,
  disconnect,
  expectDenied,
  expectDeniedSteps,
} from './harness';

/**
 * White label is where a tenant gets to put content on a page that other
 * people look at. That makes it a place where one organisation could reach
 * another, so every rule below is asserted against the database rather than
 * against the form that normally produces the value.
 *
 * Matrix entries S22–S31 in docs/SECURITY.md.
 */
afterAll(disconnect);

describe('S22 — branding is readable by members and by the people it is shown to', () => {
  it('a member of A reads A', async () => {
    expect(await countVisible(USERS.plannerA, 'organization_branding')).toBeGreaterThan(
      0,
    );
  });

  it("a member of A cannot read B's branding", async () => {
    const rows = await asUser(
      USERS.ownerA,
      'select organization_id from organization_branding where organization_id = $1',
      [ORGS.b],
    );
    expect(rows.rowCount).toBe(0);
  });

  it('a parent, who is not a member, reads the branding of the organisation that drives their child', async () => {
    // The whole point of white label: this is the person who should see the
    // transport company's name and colours, and they hold no membership.
    const rows = await asUser(
      USERS.parentA,
      'select organization_id from organization_branding where organization_id = $1',
      [ORGS.a],
    );
    expect(rows.rowCount).toBe(1);
  });

  it("a parent cannot read another organisation's branding", async () => {
    const rows = await asUser(
      USERS.parentA,
      'select organization_id from organization_branding where organization_id = $1',
      [ORGS.b],
    );
    expect(rows.rowCount).toBe(0);
  });

  it('an outsider with no relationship reads nothing', async () => {
    expect(await countVisible(USERS.outsider, 'organization_branding')).toBe(0);
  });

  it('an anonymous visitor cannot read the table at all', async () => {
    // Not "sees zero rows": anon holds no grant on the table, so the request
    // is refused before RLS is even consulted. Anonymous access goes through
    // branding_for_host, which returns four presentation columns and nothing
    // else — the table itself also carries support contact details.
    const message = await expectDenied(null, 'select * from organization_branding');
    expect(message).toContain('permission denied');
  });
});

describe('S23 — only branding.manage may write branding', () => {
  it('a driver cannot change their own organisation branding', async () => {
    const result = await asUser(
      USERS.driverA1,
      "update organization_branding set display_name = 'Overgenomen' where organization_id = $1",
      [ORGS.a],
    );
    expect(result.rowCount).toBe(0);
  });

  it('an owner of A cannot change B', async () => {
    const result = await asUser(
      USERS.ownerA,
      "update organization_branding set display_name = 'Overgenomen' where organization_id = $1",
      [ORGS.b],
    );
    expect(result.rowCount).toBe(0);
  });

  it('an owner of A cannot insert a branding row for B', async () => {
    await expectDenied(
      USERS.ownerA,
      'insert into organization_branding (organization_id) values ($1)',
      [ORGS.b],
    );
  });

  it('an owner of A may change A', async () => {
    const result = await asUser(
      USERS.ownerA,
      "update organization_branding set display_name = 'Nieuwe naam' where organization_id = $1",
      [ORGS.a],
    );
    expect(result.rowCount).toBe(1);
  });
});

describe('S24 — a logo path cannot leave its own organisation', () => {
  it("rejects a path under another organisation's folder", async () => {
    // The attack this stops: A points their logo at an object in B's folder,
    // or at an object they then replace. The CHECK makes the row itself
    // impossible, so no code path can produce it.
    const message = await expectDenied(
      USERS.ownerA,
      'update organization_branding set logo_path = $2 where organization_id = $1',
      [ORGS.a, `${ORGS.b}/logo.png`],
    );
    expect(message).toContain('branding_logo_path_scoped');
  });

  it('rejects a traversal path that starts with the right prefix', async () => {
    // The case a prefix test would have let through. A browser resolves `..`
    // before sending the request, so this value begins inside the folder and
    // ends up outside it.
    const message = await expectDenied(
      USERS.ownerA,
      'update organization_branding set logo_path = $2 where organization_id = $1',
      [ORGS.a, `${ORGS.a}/../${ORGS.b}/logo.png`],
    );
    expect(message).toContain('branding_logo_path_scoped');
  });

  it('rejects an unexpected filename inside the right folder', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      'update organization_branding set logo_path = $2 where organization_id = $1',
      [ORGS.a, `${ORGS.a}/payload.svg`],
    );
    expect(message).toContain('branding_logo_path_scoped');
  });

  it('rejects an absolute URL, which is what the old logo_url column allowed', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      'update organization_branding set logo_path = $2 where organization_id = $1',
      [ORGS.a, 'https://evil.example/pixel.png'],
    );
    expect(message).toContain('branding_logo_path_scoped');
  });

  it('accepts a path inside the organisation folder', async () => {
    const result = await asUser(
      USERS.ownerA,
      'update organization_branding set logo_path = $2 where organization_id = $1',
      [ORGS.a, `${ORGS.a}/logo.png`],
    );
    expect(result.rowCount).toBe(1);
  });

  it('rejects a colour that is not a hex literal', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      'update organization_branding set primary_color = $2 where organization_id = $1',
      [ORGS.a, '#1f47d6; background: url(//evil.example)'],
    );
    expect(message).toContain('branding_primary_hex');
  });
});

describe('S25 — the logo bucket is writable only inside your own folder', () => {
  it('an owner of A may write into A', async () => {
    const result = await asUser(
      USERS.ownerA,
      "insert into storage.objects (bucket_id, name) values ('organization-logos', $1)",
      [`${ORGS.a}/logo.png`],
    );
    expect(result.rowCount).toBe(1);
  });

  it("an owner of A may not write into B's folder", async () => {
    await expectDenied(
      USERS.ownerA,
      "insert into storage.objects (bucket_id, name) values ('organization-logos', $1)",
      [`${ORGS.b}/logo.png`],
    );
  });

  it('a driver may not write a logo at all', async () => {
    await expectDenied(
      USERS.driverA1,
      "insert into storage.objects (bucket_id, name) values ('organization-logos', $1)",
      [`${ORGS.a}/logo.png`],
    );
  });

  it('a malformed folder name is refused rather than raising', async () => {
    // The policy compares text to text. A ::uuid cast here would turn a denied
    // upload into a 500, and an error page is a worse answer than a refusal.
    await expectDenied(
      USERS.ownerA,
      "insert into storage.objects (bucket_id, name) values ('organization-logos', $1)",
      ['not-a-uuid/logo.png'],
    );
  });

  it("an owner of A may not move their own object into B's folder", async () => {
    // Written as one statement so both halves run as the same user in the same
    // transaction: the insert is allowed, the rename is not.
    await expectDeniedSteps(USERS.ownerA, [
      {
        sql: "insert into storage.objects (bucket_id, name) values ('organization-logos', $1)",
        params: [`${ORGS.a}/logo.png`],
      },
      {
        sql: 'update storage.objects set name = $2 where name = $1',
        params: [`${ORGS.a}/logo.png`, `${ORGS.b}/logo.png`],
      },
    ]);
  });
});

describe('S26 — domains belong to one organisation', () => {
  it('an owner of A cannot add a domain for B', async () => {
    await expectDenied(
      USERS.ownerA,
      'insert into organization_domains (organization_id, hostname) values ($1, $2)',
      [ORGS.b, 'gestolen.example.test'],
    );
  });

  it("an owner of A cannot delete B's domain", async () => {
    const result = await asUser(
      USERS.ownerA,
      'delete from organization_domains where organization_id = $1',
      [ORGS.b],
    );
    expect(result.rowCount).toBe(0);
  });

  it('an anonymous visitor cannot enumerate domains', async () => {
    const message = await expectDenied(null, 'select * from organization_domains');
    expect(message).toContain('permission denied');
  });
});

describe('S27 — a tenant cannot declare their own domain verified', () => {
  it('refuses a status change from the tenant', async () => {
    const message = await expectDenied(
      USERS.ownerA,
      `update organization_domains set verification_status = 'VERIFIED'
         where organization_id = $1 and verification_status = 'PENDING'`,
      [ORGS.a],
    );
    expect(message).toContain('verification is set by the server');
  });

  it('refuses rewriting the token to one the tenant already published', async () => {
    // Otherwise the challenge would be chosen by the party being challenged.
    const message = await expectDenied(
      USERS.ownerA,
      `update organization_domains set verification_token = 'chosen-by-me'
         where organization_id = $1 and verification_status = 'PENDING'`,
      [ORGS.a],
    );
    expect(message).toContain('verification is set by the server');
  });

  it('allows the tenant to change something the server does not own', async () => {
    const result = await asUser(
      USERS.ownerA,
      `update organization_domains set is_primary = false
         where organization_id = $1 and is_primary`,
      [ORGS.a],
    );
    expect(result.rowCount).toBe(1);
  });

  it('allows the server to write the outcome', async () => {
    const result = await asServiceRole(
      `update organization_domains set verification_status = 'VERIFIED', verified_at = now()
         where organization_id = $1 and verification_status = 'PENDING'`,
      [ORGS.a],
    );
    expect(result.rowCount).toBe(1);
  });
});

describe('S28 — a hostname is exclusive only once it is proven', () => {
  it('two organisations may both claim the same unverified hostname', async () => {
    // Squatting protection. A globally unique hostname would let anyone lock a
    // competitor out of their own domain by typing it first.
    const rows = await asServiceRole<{ count: string }>(
      `select count(*)::text as count from organization_domains
         where hostname = 'betwist.example.test'`,
    );
    expect(rows.rows[0]?.count).toBe('2');
  });

  it('only one of them can end up verified', async () => {
    let message = '';
    try {
      await asServiceRole(
        `update organization_domains set verification_status = 'VERIFIED'
           where hostname = 'betwist.example.test'`,
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('organization_domains_verified_hostname');
  });
});

describe('S29 — branding_for_host answers for anonymous visitors, narrowly', () => {
  it('resolves a verified hostname', async () => {
    const rows = await asUser<{ display_name: string }>(
      null,
      "select display_name from branding_for_host('dispatch.taxi-ontzorgd.test')",
    );
    expect(rows.rows[0]?.display_name).toBe('Taxi Ontzorgd');
  });

  it('ignores the port and the case', async () => {
    const rows = await asUser(
      null,
      "select * from branding_for_host('DISPATCH.Taxi-Ontzorgd.TEST:443')",
    );
    expect(rows.rowCount).toBe(1);
  });

  it('falls back from www to the apex, which the same owner proved', async () => {
    const rows = await asUser(
      null,
      "select * from branding_for_host('www.dispatch.taxi-ontzorgd.test')",
    );
    expect(rows.rowCount).toBe(1);
  });

  it('returns nothing for a hostname that is claimed but not verified', async () => {
    // This is the case that would otherwise let an organisation borrow another
    // company's identity simply by typing their domain into a form.
    const rows = await asUser(
      null,
      "select * from branding_for_host('betwist.example.test')",
    );
    expect(rows.rowCount).toBe(0);
  });

  it('returns nothing for an unknown hostname', async () => {
    const rows = await asUser(
      null,
      "select * from branding_for_host('nooit.example.test')",
    );
    expect(rows.rowCount).toBe(0);
  });

  it('tolerates rubbish input without raising', async () => {
    for (const host of ['', '   ', '.', '..', "'; drop table organizations; --"]) {
      const rows = await asUser(null, 'select * from branding_for_host($1)', [host]);
      expect(rows.rowCount).toBe(0);
    }
  });

  it('returns no support contact details', async () => {
    // Data minimisation: a page shows a name, a logo and two colours. A support
    // address exposed to anyone who can guess a hostname is a spam target.
    const rows = await asUser<{ column_name: string }>(
      null,
      `select display_name, logo_path, primary_color, secondary_color, hide_platform_branding
         from branding_for_host('dispatch.taxi-ontzorgd.test')`,
    );
    expect(Object.keys(rows.rows[0] ?? {})).toEqual([
      'display_name',
      'logo_path',
      'primary_color',
      'secondary_color',
      'hide_platform_branding',
    ]);
  });
});

describe('S30 — a suspended organisation stops being served', () => {
  it('returns nothing once the organisation is suspended', async () => {
    const rows = await asServiceRoleSteps([
      {
        sql: "update organizations set status = 'SUSPENDED' where id = $1",
        params: [ORGS.a],
      },
      { sql: "select * from branding_for_host('dispatch.taxi-ontzorgd.test')" },
    ]);
    expect(rows.rowCount).toBe(0);
  });
});
