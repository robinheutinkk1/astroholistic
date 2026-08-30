import { expect, test, type Page } from '@playwright/test';

/**
 * What a browser does with the signed-out application.
 *
 * These assertions cannot be made anywhere else. A unit test can prove the CSP
 * *string* is right; only a real browser can prove the app still hydrates under
 * it. `strict-dynamic` plus a nonce is exactly the kind of policy that is
 * correct on paper and produces a blank page in practice.
 */

/** Collects anything the browser refused to run or load. */
function watchForViolations(page: Page) {
  const violations: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (
      text.includes('Content Security Policy') ||
      text.includes('Refused to') ||
      text.includes('violates the following')
    ) {
      violations.push(text);
    }
  });
  page.on('pageerror', (error) => violations.push(`pageerror: ${error.message}`));
  return violations;
}

test.describe('security headers', () => {
  test('the login page carries the whole header set', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);

    const headers = response!.headers();
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-robots-tag']).toContain('noindex');
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    // Fase 12 found this one missing entirely: the config described a CSP in a
    // comment and set no header.
    expect(headers['content-security-policy']).toBeTruthy();
  });

  test('the CSP carries a nonce and never unsafe-inline for scripts', async ({
    page,
  }) => {
    const response = await page.goto('/login');
    const csp = response!.headers()['content-security-policy'] ?? '';

    const scriptSrc = csp
      .split('; ')
      .find((directive) => directive.startsWith('script-src'));

    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    // The production build must not allow eval; only the dev server does.
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  test('a fresh nonce per response', async ({ page }) => {
    const first = (await page.goto('/login'))!.headers()['content-security-policy'];
    const second = (await page.goto('/login'))!.headers()['content-security-policy'];
    expect(first).not.toBe(second);
  });
});

test.describe('the app works under its own CSP', () => {
  test('the login page hydrates and the form reacts', async ({ page }) => {
    const violations = watchForViolations(page);

    await page.goto('/login');
    // Exactly one <h1>, and it is the page's own subject. This failed on the
    // first run: the card title rendered as <h3> and the page had no <h1> at
    // all, so a screen reader announced it with no heading (§48).
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Inloggen' })).toBeVisible();

    const email = page.getByLabel('E-mailadres');
    await email.fill('iemand@voorbeeld.test');
    await expect(email).toHaveValue('iemand@voorbeeld.test');

    // Submitting with an invalid password exercises the Server Action round
    // trip, which is the part that breaks first when a CSP is wrong.
    await page.getByLabel('Wachtwoord').fill('onjuist-wachtwoord');
    await page.getByRole('button', { name: /inloggen/i }).click();

    // Whatever the answer is, the page must still be alive and must not have
    // been blocked by the policy.
    await expect(page.getByRole('button', { name: /inloggen/i })).toBeVisible();
    expect(violations).toEqual([]);
  });

  test('no script is loaded without the nonce', async ({ page }) => {
    await page.goto('/login');

    const unnonced = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script'))
        .filter((script) => !script.nonce && !script.src.startsWith('http'))
        .map((script) => script.outerHTML.slice(0, 80)),
    );

    expect(unnonced).toEqual([]);
  });
});

test.describe('the NFC landing page tells an anonymous visitor nothing', () => {
  const PROBES = [
    // A plausible-looking token, an implausible one, and an injection attempt.
    'TP0123456789ABCDEFGHJKMNPQ',
    'niet-een-token',
    "'; select 1; --",
  ];

  for (const token of PROBES) {
    test(`"${token.slice(0, 20)}" gives the same page`, async ({ page }) => {
      const response = await page.goto(`/t/${encodeURIComponent(token)}`);
      expect(response?.status()).toBe(200);

      const body = (await page.textContent('body')) ?? '';

      // The strictest rule in the product (docs/NFC.md §5): no name, no
      // organisation, and no hint about whether the token is real.
      expect(body).toContain('Log in om verder te gaan');
      expect(body).not.toMatch(/Taxi Ontzorgd|Voorbeeld Taxi/);
      expect(body).not.toMatch(/bestaat niet|onbekend|ongeldig/i);
    });
  }

  test('the answer is byte-for-byte the same for a real-looking and a fake token', async ({
    page,
  }) => {
    // Not just "similar": a difference in length or wording is an oracle for
    // finding real tags.
    await page.goto('/t/TP0123456789ABCDEFGHJKMNPQ');
    const first = await page.textContent('main');

    await page.goto('/t/TPZZZZZZZZZZZZZZZZZZZZZZZZ');
    const second = await page.textContent('main');

    expect(first).toBe(second);
  });
});

test.describe('nothing scrolls sideways on a phone', () => {
  // The single most common mobile defect, and the one a desktop browser never
  // shows you: something a few pixels too wide makes the whole page pan, and
  // every tap lands in the wrong place. Checked on the pages that are reachable
  // without signing in.
  const PAGES = ['/login', '/forgot-password', '/t/TP0123456789ABCDEFGHJKMNPQ'];

  for (const path of PAGES) {
    test(`${path} fits the viewport`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        // One pixel of slack: sub-pixel rounding is not a layout bug.
        if (doc.scrollWidth <= doc.clientWidth + 1) return null;
        // Name the widest element, so a failure says which one to fix.
        const guilty = Array.from(document.querySelectorAll('*'))
          .map((el) => ({ el, right: el.getBoundingClientRect().right }))
          .filter((entry) => entry.right > doc.clientWidth + 1)
          .sort((a, b) => b.right - a.right)[0];
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          widest: guilty ? guilty.el.outerHTML.slice(0, 120) : 'unknown',
        };
      });

      expect(overflow).toBeNull();
    });
  }

  test('the touch targets on the tag page are big enough', async ({ page }) => {
    // 44px is the smallest target a thumb hits reliably (§48). A driver uses
    // this one-handed, next to a running vehicle.
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/t/TP0123456789ABCDEFGHJKMNPQ');

    const link = page.getByRole('link').first();
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});

test.describe('the health endpoint', () => {
  test('answers without leaking anything', async ({ request }) => {
    const response = await request.get('/api/health');

    // Either state is a valid answer; what matters is the shape. In this
    // environment there is no reachable Supabase, so 503 is expected.
    expect([200, 503]).toContain(response.status());
    expect(response.headers()['cache-control']).toContain('no-store');

    const body: unknown = await response.json();
    // Exactly two fields, both of which a stranger may know. A health check
    // that helpfully reports "relation X does not exist" is a free schema dump.
    expect(Object.keys(body as object).sort()).toEqual(['database', 'status']);
    expect(JSON.stringify(body)).not.toMatch(/supabase|postgres|relation|error/i);
  });
});

test.describe('routing for a signed-out visitor', () => {
  test('the front door leads to the login page, not a brochure', async ({ page }) => {
    // The root used to be a phase-1 placeholder that announced which phase the
    // project was in. Nobody who arrives here wants a product description:
    // they are a planner, a driver or a parent who wants their own screen.
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('a protected page redirects to login and remembers where you were going', async ({
    page,
  }) => {
    await page.goto('/planning');
    await expect(page).toHaveURL(/\/login\?next=%2Fplanning/);
  });

  test('the API answers with a status code, not an HTML login page', async ({
    request,
  }) => {
    // A redirect here would mean the nightly cron job silently never runs
    // (found in fase 5) and that any API client gets HTML where it expects JSON.
    const response = await request.get('/api/rapportages/export?kind=per-dag');
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });
});

test.describe('de 404-pagina', () => {
  test('een onbekend publiek adres toont de Nederlandse uitleg, niet de frameworkpagina', async ({
    page,
  }) => {
    // Onder een publiek pad, want een uitgelogde bezoeker wordt elders eerst
    // naar het loginscherm gestuurd voordat de 404 aan bod komt.
    await page.goto('/login/bestaat-niet');

    await expect(
      page.getByRole('heading', { name: 'Deze pagina bestaat niet' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Naar het beginscherm' })).toBeVisible();
  });
});

test.describe('automatisch uitloggen na inactiviteit', () => {
  /*
   * Alleen wat zonder ingelogde sessie te bewijzen valt: dat de melding
   * verschijnt en dat de chauffeursapp buiten de regel valt. Of de klok echt
   * afloopt zit in de unittest op session-timeout.ts; hier gaat het erom dat de
   * gebruiker te zien krijgt wat er is gebeurd in plaats van een loginscherm
   * dat op een storing lijkt.
   */
  test('de loginpagina legt uit waarom je bent uitgelogd', async ({ page }) => {
    await page.goto('/login?reden=verlopen');

    await expect(page.getByRole('status')).toContainText('automatisch uitgelogd');
  });

  test('zonder die reden staat er geen melding', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('een onbekende reden verzint geen melding', async ({ page }) => {
    // De query string is door de gebruiker te bewerken. Een willekeurige waarde
    // mag geen tekst op het scherm zetten.
    await page.goto('/login?reden=<script>alert(1)</script>');

    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('de chauffeursapp stuurt door naar login met zijn eigen bestemming', async ({
    page,
  }) => {
    // De vrijstelling gaat over de inactiviteitsklok, niet over inloggen zelf:
    // zonder sessie komt ook een chauffeur op het loginscherm.
    await page.goto('/driver');

    await expect(page).toHaveURL(/\/login\?next=%2Fdriver/);
  });
});
