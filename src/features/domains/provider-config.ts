import 'server-only';
import { createVercelProvider, manualProvider, type DomainProvider } from './provider';

/**
 * Which platform, according to the environment.
 *
 * Separated from ./provider so that module stays free of `server-only` and
 * every branch of the provider itself is testable. This file is the only place
 * that touches the platform credentials.
 *
 * THE NAMES DO NOT START WITH `VERCEL_`, and that is not a style choice:
 * Vercel reserves that prefix for its own system variables and refuses to
 * create one. The first version of this used `VERCEL_API_TOKEN` and could not
 * be configured at all — the dashboard answered "Environment variable
 * VERCEL_API_TOKEN is invalid". The system variables it *does* provide are
 * still read as a fallback, so on Vercel only the token needs setting.
 */
export function getDomainProvider(): DomainProvider {
  const token = process.env['HOSTING_API_TOKEN'];

  // Vercel injects VERCEL_PROJECT_ID itself, so on Vercel this needs no
  // configuring at all. HOSTING_PROJECT_ID exists for everywhere else.
  const projectId = process.env['HOSTING_PROJECT_ID'] ?? process.env['VERCEL_PROJECT_ID'];

  // Both halves or neither. A token without a project id is a half-finished
  // setup, and guessing the project would attach a tenant's domain to the
  // wrong deployment.
  if (!token || !projectId) return manualProvider;

  return createVercelProvider(
    token,
    projectId,
    process.env['HOSTING_TEAM_ID'] ?? process.env['VERCEL_TEAM_ID'],
  );
}
