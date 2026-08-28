import { afterAll, describe, expect, it } from 'vitest';
import { asServiceRoleSteps, disconnect, expectDenied } from './harness';

/**
 * The rate limiter.
 *
 * Fase 12 shipped this without an automated test and said so. That was too
 * pessimistic: the logic lives in `consume_rate_limit()`, which is SQL, and
 * this suite already talks to PostgreSQL as `service_role`. Only the thin
 * TypeScript wrapper is out of reach here — and the wrapper contains no
 * decisions, just the limits table and a fail-open catch.
 *
 * Matrix entries S54–S57 in docs/SECURITY.md.
 */
afterAll(disconnect);

/** A distinct subject per test, so one test cannot exhaust another's budget. */
function subject(name: string): string {
  return `${name}-${Math.random().toString(36).slice(2)}`;
}

describe('S54 — the limiter counts and then refuses', () => {
  it('allows up to the limit and refuses the next one', async () => {
    const who = subject('basic');
    const rows = await asServiceRoleSteps<{ a: boolean; b: boolean; c: boolean }>([
      {
        sql: `select consume_rate_limit('test', $1, 2, 900) as a,
                     consume_rate_limit('test', $1, 2, 900) as b,
                     consume_rate_limit('test', $1, 2, 900) as c`,
        params: [who],
      },
    ]);
    expect(rows.rows[0]).toEqual({ a: true, b: true, c: false });
  });

  it('keeps refusing once the bucket is full', async () => {
    // A lockout that lifts because the attacker kept trying is not a lockout.
    // Every attempt is recorded, including the refused ones.
    const who = subject('persistent');
    const rows = await asServiceRoleSteps<{ fourth: boolean }>([
      {
        sql: `select consume_rate_limit('test', $1, 1, 900),
                     consume_rate_limit('test', $1, 1, 900),
                     consume_rate_limit('test', $1, 1, 900),
                     consume_rate_limit('test', $1, 1, 900) as fourth`,
        params: [who],
      },
    ]);
    expect(rows.rows[0]?.fourth).toBe(false);
  });

  it('counts each subject separately', async () => {
    // Otherwise one busy user silences everyone behind the same office NAT.
    const rows = await asServiceRoleSteps<{ other: boolean }>([
      {
        sql: `select consume_rate_limit('test', $1, 1, 900),
                     consume_rate_limit('test', $1, 1, 900),
                     consume_rate_limit('test', $2, 1, 900) as other`,
        params: [subject('a'), subject('b')],
      },
    ]);
    expect(rows.rows[0]?.other).toBe(true);
  });

  it('counts each bucket separately', async () => {
    // Signing in must not spend the password-reset allowance.
    const who = subject('buckets');
    const rows = await asServiceRoleSteps<{ other: boolean }>([
      {
        sql: `select consume_rate_limit('login-ip', $1, 1, 900),
                     consume_rate_limit('login-ip', $1, 1, 900),
                     consume_rate_limit('password-reset-ip', $1, 1, 900) as other`,
        params: [who],
      },
    ]);
    expect(rows.rows[0]?.other).toBe(true);
  });
});

describe('S55 — the window actually moves', () => {
  it('ignores attempts older than the window', async () => {
    const who = subject('window');
    const rows = await asServiceRoleSteps<{ allowed: boolean }>([
      {
        sql: "select consume_rate_limit('test', $1, 1, 900)",
        params: [who],
      },
      {
        // Age that attempt past the window rather than waiting fifteen minutes.
        sql: `update rate_limit_hits
                 set occurred_at = now() - interval '20 minutes'
               where bucket = 'test'`,
      },
      {
        sql: "select consume_rate_limit('test', $1, 1, 900) as allowed",
        params: [who],
      },
    ]);
    expect(rows.rows[0]?.allowed).toBe(true);
  });

  it('still refuses an attempt inside the window', async () => {
    const who = subject('window-inside');
    const rows = await asServiceRoleSteps<{ allowed: boolean }>([
      { sql: "select consume_rate_limit('test', $1, 1, 900)", params: [who] },
      {
        sql: `update rate_limit_hits set occurred_at = now() - interval '5 minutes'
               where bucket = 'test'`,
      },
      {
        sql: "select consume_rate_limit('test', $1, 1, 900) as allowed",
        params: [who],
      },
    ]);
    expect(rows.rows[0]?.allowed).toBe(false);
  });
});

describe('S56 — only the server may operate the limiter', () => {
  it('an anonymous caller cannot invoke it', async () => {
    // If anon could reach this, an attacker could pass a limit of a million —
    // or burn somebody else's allowance and lock them out of their account.
    const message = await expectDenied(
      null,
      "select consume_rate_limit('login-ip', 'someone', 5, 900)",
    );
    expect(message).toContain('permission denied');
  });

  it('a signed-in user cannot invoke it either', async () => {
    const message = await expectDenied(
      'a0000000-0000-4000-8000-000000000001',
      "select consume_rate_limit('login-ip', 'someone', 5, 900)",
    );
    expect(message).toContain('permission denied');
  });

  it('nobody can read the hit table', async () => {
    const message = await expectDenied(
      'a0000000-0000-4000-8000-000000000001',
      'select * from rate_limit_hits',
    );
    expect(message).toContain('permission denied');
  });
});

describe('S57 — the table does not grow forever', () => {
  it('the sweep removes old rows and keeps recent ones', async () => {
    const rows = await asServiceRoleSteps<{ remaining: string }>([
      {
        sql: "select consume_rate_limit('sweep-old', 'x', 10, 900)",
      },
      {
        sql: `update rate_limit_hits set occurred_at = now() - interval '48 hours'
               where bucket = 'sweep-old'`,
      },
      { sql: "select consume_rate_limit('sweep-new', 'x', 10, 900)" },
      { sql: 'select sweep_rate_limit_hits(24)' },
      {
        sql: `select count(*)::text as remaining from rate_limit_hits
               where bucket in ('sweep-old', 'sweep-new')`,
      },
    ]);
    // The old one is gone, the recent one survives.
    expect(rows.rows[0]?.remaining).toBe('1');
  });

  it('the subject is stored hashed, not in plain text', async () => {
    // A rate-limit table is where a readable list of e-mail addresses quietly
    // accumulates in something nobody thinks of as personal data (§38).
    //
    // Two statements, not one. The first version of this test called the
    // function and read the table in a single statement, so the row it had just
    // written was not yet in its snapshot: the count was zero whatever the
    // function stored, and the test passed for the wrong reason. A mutation
    // that wrote the address in plain text went straight through it.
    const rows = await asServiceRoleSteps<{ found: string; total: string }>([
      {
        sql: "select consume_rate_limit('hashcheck', 'gevoelig@voorbeeld.test', 5, 900)",
      },
      {
        sql: `select
                count(*) filter (
                  where encode(subject_hash, 'escape') like '%gevoelig%'
                )::text as found,
                count(*)::text as total
              from rate_limit_hits where bucket = 'hashcheck'`,
      },
    ]);
    // The row must exist — otherwise "nothing readable" is trivially true.
    expect(rows.rows[0]?.total).toBe('1');
    expect(rows.rows[0]?.found).toBe('0');
  });
});
