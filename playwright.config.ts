import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests.
 *
 * WHAT RUNS HERE AND WHAT DOES NOT. The specs split in two.
 *
 * `tests/e2e/public.spec.ts` needs only the application: signed-out pages, the
 * NFC landing page, and the security headers. Those run everywhere, and they
 * cover the one thing no unit test can — whether the app actually works in a
 * browser under its own Content-Security-Policy.
 *
 * `tests/e2e/critical-path.spec.ts` needs a signed-in session, which means a
 * running GoTrue (`npm run db:start`). Where that is unavailable the whole file
 * skips with a message saying why, rather than failing and teaching everyone to
 * ignore a red run.
 */
/**
 * An escape hatch for environments that already have a Chromium and cannot
 * download another one — a locked-down CI image, or a sandbox where the
 * outbound fetch is blocked. Unset everywhere else, so the normal path stays
 * "Playwright manages its own browser".
 */
const chromiumPath = process.env['PLAYWRIGHT_CHROMIUM_PATH'];
const launchOverride = chromiumPath
  ? { launchOptions: { executablePath: chromiumPath } }
  : {};

const PORT = Number(process.env['E2E_PORT'] ?? 3210);
const baseURL = process.env['E2E_BASE_URL'] ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Serial: these share one server and one database. Parallelism here buys
  // seconds and costs an afternoon of chasing flakes.
  workers: 1,
  fullyParallel: false,
  // A retry hides a flake instead of showing it. If a test is unreliable that
  // is the finding, not the noise.
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env['CI'] ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...launchOverride } },
    // The driver app is mobile-first (§67.19); testing it on a desktop viewport
    // would miss exactly the layout it was designed for.
    { name: 'mobile', use: { ...devices['Pixel 7'], ...launchOverride } },
  ],
  webServer: {
    // Production build, not `next dev`: the CSP differs between them
    // (development allows 'unsafe-eval'), and it is the production policy that
    // has to not break the app.
    command: `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? 'e2e-placeholder-anon-key',
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_PLATFORM_HOST: `127.0.0.1:${PORT}`,
    },
  },
});
