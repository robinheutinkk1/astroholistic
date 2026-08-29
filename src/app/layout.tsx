import type { Metadata, Viewport } from 'next';
import { brandStyle } from '@/features/branding/theme';
import { getHostBranding } from '@/features/branding/host';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Tagpoint Taxi Dispatch',
    template: '%s · Tagpoint',
  },
  description: 'Planning, dispatch en ritregistratie voor vervoersbedrijven.',
  // Personal data must never reach a search index or a link preview.
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: 'Tagpoint',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  // viewportFit lets the driver screen use the full height on notched phones,
  // with safe-area padding handled in CSS.
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  // Not maximumScale: 1 — locking zoom breaks accessibility for users who
  // need to enlarge text (§48).
  themeColor: '#1f47d6',
};

/**
 * Branding is applied here, at the root, so that *every* shell inherits it:
 * the login page, the NFC landing page, the driver app and the portal. A shell
 * that knows better — one where the signed-in user's organisation is known —
 * overrides these same custom properties further down the tree.
 *
 * Reading the Host header makes the whole tree dynamic. That is the price of
 * showing a tenant their own colours before they sign in, and it is the right
 * trade: nearly every page here already depends on the session.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await getHostBranding();

  return (
    <html lang="nl">
      <body
        className="min-h-dvh"
        style={brandStyle({
          primary_color: branding?.primaryColor ?? null,
          secondary_color: branding?.secondaryColor ?? null,
        })}
      >
        {children}
      </body>
    </html>
  );
}
