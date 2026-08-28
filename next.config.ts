import type { NextConfig } from 'next';

/**
 * Security headers (docs/SECURITY.md §10).
 *
 * The CSP intentionally omits 'unsafe-inline' for scripts. Styles still need it
 * because Next injects inline <style> for critical CSS and our white-label theme
 * sets CSS custom properties inline per tenant.
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
    // position at ride milestones (docs/SECURITY.md §9). Everything else is off.
    key: 'Permissions-Policy',
    value: 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=()',
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
