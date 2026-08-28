import { verificationRecordName } from './hostname';

/**
 * Attaching a verified hostname to the hosting platform.
 *
 * WHY THIS IS BEHIND AN INTERFACE. Proving that a tenant owns a domain is our
 * problem and it is solved (migration 0021, the TXT record). Getting a TLS
 * certificate for that domain is the hosting platform's problem, and the two
 * plausible answers differ completely:
 *
 *   - the hosting provider issues it (on Vercel: the Domains API), or
 *   - a CDN in front issues it (Cloudflare for SaaS).
 *
 * That choice is not made yet (decision D-23), and it should not be able to
 * leak into the verification logic. So verification calls `attachDomain()` and
 * does not care what happens next.
 *
 * THE DEFAULT IS "DO NOTHING, AND SAY SO". Not a silent no-op: an unconfigured
 * platform returns MANUAL, which the service records and the screen shows, so
 * an administrator knows a human step is still owed. A domain that verifies and
 * then quietly serves nothing is the worst of the three outcomes.
 *
 * This module takes its credentials as arguments and is therefore free of
 * `server-only`, which is what makes every branch below testable. Reading them
 * from the environment happens in ./provider-config, which is not.
 */
export type AttachOutcome =
  | { readonly status: 'ATTACHED' }
  /** No provider configured: someone has to add the domain by hand. */
  | { readonly status: 'MANUAL' }
  | { readonly status: 'FAILED'; readonly reason: string };

export interface DomainProvider {
  readonly name: string;
  attach(hostname: string): Promise<AttachOutcome>;
}

export const manualProvider: DomainProvider = {
  name: 'manual',
  attach: () => Promise.resolve({ status: 'MANUAL' as const }),
};

/**
 * Vercel's Domains API.
 *
 * Adding the domain to the project is what makes Vercel route it and request a
 * certificate. It is idempotent in the way that matters: a domain already on
 * the project comes back as a conflict, which is success, not failure.
 */
export function createVercelProvider(
  token: string,
  projectId: string,
  teamId?: string,
): DomainProvider {
  return {
    name: 'vercel',
    async attach(hostname: string): Promise<AttachOutcome> {
      const url = new URL(`https://api.vercel.com/v10/projects/${projectId}/domains`);
      if (teamId) url.searchParams.set('teamId', teamId);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ name: hostname }),
          // A slow platform API must not hold a Server Action open.
          signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        return {
          status: 'FAILED',
          reason: error instanceof Error ? error.name : 'network',
        };
      }

      if (response.ok) return { status: 'ATTACHED' };

      // 409: already on the project. That is the state we wanted.
      if (response.status === 409) return { status: 'ATTACHED' };

      // The body can name the project and the team. Only the status goes on,
      // so nothing about our hosting setup reaches a tenant's screen.
      return { status: 'FAILED', reason: `http_${response.status}` };
    },
  };
}

/**
 * What an administrator has to do by hand when no provider is configured.
 *
 * Kept next to the provider so the instruction and the code that makes it
 * necessary cannot drift apart.
 */
export function manualAttachInstructions(hostname: string): string {
  return (
    `Voeg ${hostname} toe aan het hostingproject en laat daar een certificaat ` +
    `uitgeven. Het verificatierecord ${verificationRecordName(hostname)} mag ` +
    `blijven staan.`
  );
}
