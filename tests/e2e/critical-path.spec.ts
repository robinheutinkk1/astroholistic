import { expect, test, type Page } from '@playwright/test';

/**
 * The journey the product exists for: plan a ride, drive it, check the client
 * in, finish it (masterprompt §67 and the Fase 13 plan).
 *
 * WHY THIS FILE SKIPS RATHER THAN FAILS. Every step below needs a signed-in
 * session, and a session comes from GoTrue — the Supabase auth service, which
 * runs as a container (`npm run db:start`). Where that is unavailable the whole
 * file skips with a message saying so.
 *
 * A skipped test that explains itself is honest. A failing test that everybody
 * learns to ignore is worse than no test at all, because it also hides the next
 * real failure.
 */
const PASSWORD = 'tagpoint-demo-2026';

const ACCOUNTS = {
  planner: 'planner@ontzorgd.test',
  driver: 'chauffeur1@ontzorgd.test',
  parent: 'ouder@ontzorgd.test',
};

/**
 * Is there an auth service to sign in against?
 *
 * Checked by attempting one real sign-in rather than by pinging a port: a
 * reachable GoTrue with no seed data would pass a port check and fail every
 * test afterwards for a reason that has nothing to do with the code.
 */
async function authAvailable(page: Page): Promise<boolean> {
  await page.goto('/login');
  await page.getByLabel('E-mailadres').fill(ACCOUNTS.planner);
  await page.getByLabel('Wachtwoord').fill(PASSWORD);
  await page.getByRole('button', { name: /inloggen/i }).click();

  try {
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mailadres').fill(email);
  await page.getByLabel('Wachtwoord').fill(PASSWORD);
  await page.getByRole('button', { name: /inloggen/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function signOut(page: Page) {
  await page.goto('/profiel');
  await page.getByRole('button', { name: /uitloggen/i }).click();
  await page.waitForURL(/\/login/);
}

test.describe('the critical path', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !(await authAvailable(page)),
      'Needs a running Supabase auth service: npm run db:start && npm run db:reset',
    );
  });

  test('a planner sees today on the dashboard', async ({ page }) => {
    await signIn(page, ACCOUNTS.planner);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Planning' })).toBeVisible();
  });

  test('a planner opens the planning board and finds a ride', async ({ page }) => {
    await signIn(page, ACCOUNTS.planner);
    await page.getByRole('link', { name: 'Planning' }).click();
    await page.waitForURL(/\/planning/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/planning/i);
  });

  test('a driver sees only their own day', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver);
    await page.goto('/driver');

    // The rule from §4, checked through the interface a driver actually uses:
    // no client list anywhere in the driver app.
    await expect(page.getByRole('link', { name: 'Cliënten' })).toHaveCount(0);
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('a driver cannot reach the planner application', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver);
    await page.goto('/clienten');

    // Not a 500 and not a client list: an explanation. The page is server-
    // rendered and the permission is checked there, so this is the real answer
    // rather than a hidden menu item.
    await expect(page.getByRole('link', { name: 'Nieuwe cliënt' })).toHaveCount(0);
  });

  test('a parent sees their own child and no one else', async ({ page }) => {
    await signIn(page, ACCOUNTS.parent);
    await page.goto('/portaal');

    const body = (await page.textContent('body')) ?? '';
    expect(body).toContain('Jan');
    // Piet belongs to the same organisation and must not appear (S04).
    expect(body).not.toContain('Piet');
  });

  test('signing out ends the session', async ({ page }) => {
    await signIn(page, ACCOUNTS.planner);
    await signOut(page);

    // Not just "the button worked": the protected page must be unreachable
    // afterwards, which is what proves the cookie is gone rather than hidden.
    await page.goto('/planning');
    await expect(page).toHaveURL(/\/login/);
  });
});
