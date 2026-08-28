import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createVercelProvider,
  manualAttachInstructions,
  manualProvider,
} from './provider';

/**
 * The provider seam. What matters is the fallback: an unconfigured platform
 * must produce a visible manual step, never a silent nothing.
 */
const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllGlobals();
});

describe('the manual provider', () => {
  it('reports a manual step rather than silent success', async () => {
    // The fallback that matters: a domain that verifies and then quietly
    // serves nothing is the worst possible outcome.
    expect(manualProvider.name).toBe('manual');
    await expect(manualProvider.attach('vervoer.voorbeeld.nl')).resolves.toEqual({
      status: 'MANUAL',
    });
  });
});

describe('the Vercel provider', () => {
  function configure() {
    return createVercelProvider('token', 'prj_123');
  }

  it('reports success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    );
    await expect(configure().attach('vervoer.voorbeeld.nl')).resolves.toEqual({
      status: 'ATTACHED',
    });
  });

  it('treats "already on the project" as success', async () => {
    // Verification can legitimately run twice — a tenant clicking again, a
    // retry after a timeout. The second attempt must not report a failure.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error":"exists"}', { status: 409 })),
    );
    await expect(configure().attach('vervoer.voorbeeld.nl')).resolves.toEqual({
      status: 'ATTACHED',
    });
  });

  it('reports a failure without repeating the platform response', async () => {
    // The body names our project and team. A tenant's screen is not the place
    // for that, so only the status code travels.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"error":{"message":"project prj_secret not found"}}', {
          status: 403,
        }),
      ),
    );

    const result = await configure().attach('vervoer.voorbeeld.nl');
    expect(result).toEqual({ status: 'FAILED', reason: 'http_403' });
    expect(JSON.stringify(result)).not.toContain('prj_secret');
  });

  it('survives a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(configure().attach('vervoer.voorbeeld.nl')).resolves.toEqual({
      status: 'FAILED',
      reason: 'TypeError',
    });
  });

  it('sends the hostname to the project endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await configure().attach('vervoer.voorbeeld.nl');

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toContain('/projects/prj_123/domains');
    expect(init.body).toBe(JSON.stringify({ name: 'vervoer.voorbeeld.nl' }));
  });
});

describe('manualAttachInstructions', () => {
  it('names the hostname and leaves the verification record alone', async () => {
    const text = manualAttachInstructions('vervoer.voorbeeld.nl');
    expect(text).toContain('vervoer.voorbeeld.nl');
    expect(text).toContain('_tagpoint-verify.vervoer.voorbeeld.nl');
    await Promise.resolve();
  });
});
