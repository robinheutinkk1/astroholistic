import 'server-only';
import { createVercelProvider, manualProvider, type DomainProvider } from './provider';

/**
 * Which platform, according to the environment.
 *
 * Separated from ./provider so that module stays free of `server-only` and
 * every branch of the provider itself is testable. This file is the only place
 * that touches the platform credentials.
 */
export function getDomainProvider(): DomainProvider {
  const token = process.env['VERCEL_API_TOKEN'];
  const projectId = process.env['VERCEL_PROJECT_ID'];

  // Both halves or neither. A token without a project id is a half-finished
  // setup, and guessing the project would attach a tenant's domain to the
  // wrong deployment.
  if (!token || !projectId) return manualProvider;

  return createVercelProvider(token, projectId, process.env['VERCEL_TEAM_ID']);
}
