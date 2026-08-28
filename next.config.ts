import type { NextConfig } from 'next';

/**
 * Security headers (docs/SECURITY.md §10).
 *
 * The Content-Security-Policy is NOT here. It is set per request in
 * `src/proxy.ts`, because it carries a nonce that has to be different on every
 * response — a static CSP in this file would either need `unsafe-inline`
 * (which is no policy at all) or would break Next's own bootstrap script.
 *
 * Everything below is genuinely static and belongs here.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    // Geolocation is granted only because the driver PWA records a single
    // position at ride milestones (docs/SECURITY.md §9). Camera is granted for
    // QR scanning on the same screens. Everything else is off.
    key: 'Permissions-Policy',
    value:
      'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()',
  },
  {
    // This product shows personal data on every signed-in page. None of it
    // belongs in a search index or a link preview, and `robots` metadata in the
    // page is not enough for a file served by a route handler.
    key: 'X-Robots-Tag',
    value: 'noindex, nofollow, noarchive',
  },
  {
    // Isolates the browsing-context group, so a window this app opens (or that
    // opens it) cannot reach into it via window.opener.
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  headers() {
    // Next requires a Promise here; there is nothing asynchronous to do.
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default nextConfig;
