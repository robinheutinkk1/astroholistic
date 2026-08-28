import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TagPoint Taxi Dispatch',
    template: '%s · TagPoint',
  },
  description: 'Planning, dispatch en ritregistratie voor vervoersbedrijven.',
  // Personal data must never reach a search index or a link preview.
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: 'TagPoint',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
