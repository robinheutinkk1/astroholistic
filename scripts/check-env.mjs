#!/usr/bin/env node
/**
 * Preflight check on the environment, before a deploy.
 *
 * Every variable below is already validated at runtime — `lib/env.ts` on the
 * public ones, `lib/env.server.ts` on the secrets. This script exists because
 * of *when* those fire: a missing TAG_TOKEN_PEPPER surfaces the first time
 * somebody creates an NFC tag, which could be a week after the deploy that
 * broke it. Here it surfaces before the deploy.
 *
 * It also catches the two mistakes validation cannot see, because both produce
 * a perfectly valid value in the wrong place:
 *
 *   1. a service-role key in a NEXT_PUBLIC_ variable, which ships the key that
 *      bypasses every RLS policy to the browser (threat T11);
 *   2. a placeholder or localhost value in a production deploy.
 *
 * Usage: node scripts/check-env.mjs [--production]
 */
const production =
  process.argv.includes('--production') || process.env.VERCEL_ENV === 'production';

const problems = [];
const warnings = [];

function fail(message) {
  problems.push(message);
}
function warn(message) {
  warnings.push(message);
}

const env = process.env;

// --- Required everywhere ---------------------------------------------------
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_PLATFORM_HOST',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TAG_TOKEN_PEPPER',
  'CRON_SECRET',
];

for (const name of REQUIRED) {
  if (!env[name] || env[name].trim() === '') fail(`${name} is not set`);
}

// --- Shapes ----------------------------------------------------------------
if (env.TAG_TOKEN_PEPPER && env.TAG_TOKEN_PEPPER.length < 32) {
  fail('TAG_TOKEN_PEPPER is shorter than 32 characters');
}
if (env.CRON_SECRET && env.CRON_SECRET.length < 16) {
  fail('CRON_SECRET is shorter than 16 characters');
}

for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_APP_URL']) {
  if (!env[name]) continue;
  try {
    new URL(env[name]);
  } catch {
    fail(`${name} is not a valid URL: ${env[name]}`);
  }
}

/**
 * A Supabase JWT — anon or service_role — is a three-part token whose middle
 * segment decodes to JSON naming the role. That is how a service-role key is
 * told apart from an anon key without knowing either.
 */
function supabaseRole(value) {
  const parts = (value ?? '').split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

// --- The mistake that matters most -----------------------------------------
for (const [name, value] of Object.entries(env)) {
  if (!name.startsWith('NEXT_PUBLIC_')) continue;
  if (supabaseRole(value) === 'service_role') {
    fail(
      `${name} contains a service_role key. That key bypasses every RLS policy ` +
        'and NEXT_PUBLIC_ variables are compiled into the browser bundle.',
    );
  }
}

const anonRole = supabaseRole(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY && anonRole && anonRole !== 'anon') {
  fail(`NEXT_PUBLIC_SUPABASE_ANON_KEY carries role "${anonRole}", expected "anon"`);
}

const serviceRole = supabaseRole(env.SUPABASE_SERVICE_ROLE_KEY);
if (env.SUPABASE_SERVICE_ROLE_KEY && serviceRole && serviceRole !== 'service_role') {
  fail(
    `SUPABASE_SERVICE_ROLE_KEY carries role "${serviceRole}", expected "service_role"`,
  );
}

if (
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  env.SUPABASE_SERVICE_ROLE_KEY &&
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY
) {
  fail('The anon key and the service-role key are the same value');
}

// --- Production-only -------------------------------------------------------
if (production) {
  const PLACEHOLDERS = ['placeholder', 'your-', 'changeme', 'example', 'test-key'];

  for (const name of REQUIRED) {
    const value = (env[name] ?? '').toLowerCase();
    if (PLACEHOLDERS.some((needle) => value.includes(needle))) {
      fail(`${name} still looks like a placeholder: ${env[name]}`);
    }
  }

  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_APP_URL']) {
    const value = env[name] ?? '';
    if (value.startsWith('http://')) {
      fail(`${name} is http:// in production; cookies and HSTS require https`);
    }
    if (value.includes('localhost') || value.includes('127.0.0.1')) {
      fail(`${name} points at localhost in production: ${value}`);
    }
  }

  if ((env.NEXT_PUBLIC_PLATFORM_HOST ?? '').includes('localhost')) {
    fail('NEXT_PUBLIC_PLATFORM_HOST points at localhost in production');
  }

  // Not fatal: a tenant domain can be attached without this, it just has to be
  // done by hand at the hosting provider (see docs/DEPLOYMENT.md).
  const hostingProject = env.HOSTING_PROJECT_ID || env.VERCEL_PROJECT_ID;
  if (!env.HOSTING_API_TOKEN || !hostingProject) {
    warn(
      'HOSTING_API_TOKEN / HOSTING_PROJECT_ID are not set: a verified tenant ' +
        'domain will not be attached automatically and needs a manual step.',
    );
  }

  // Vercel refuses to create an environment variable whose name starts with
  // VERCEL_, so a value here means somebody is about to be confused.
  for (const name of Object.keys(env)) {
    if (name.startsWith('VERCEL_') && name.endsWith('_API_TOKEN')) {
      fail(
        `${name} cannot be set on Vercel: the VERCEL_ prefix is reserved. ` +
          'Use HOSTING_API_TOKEN.',
      );
    }
  }
}

// --- Report ----------------------------------------------------------------
for (const message of warnings) console.warn(`warning: ${message}`);

if (problems.length > 0) {
  console.error('');
  for (const message of problems) console.error(`error: ${message}`);
  console.error(`\n${problems.length} problem(s). Not safe to deploy.`);
  process.exit(1);
}

console.log(
  production
    ? 'Environment looks right for a production deploy.'
    : 'Environment looks right.',
);
