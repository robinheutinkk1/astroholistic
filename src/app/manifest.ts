import type { MetadataRoute } from 'next';

/**
 * PWA manifest.
 *
 * `start_url` points at the driver screen, not the root: a driver who adds this
 * to their home screen wants today's rides, not a login redirect chain.
 *
 * `display: standalone` removes the browser chrome, which buys back roughly
 * 100px of vertical space — real estate that matters on a phone held in one
 * hand beside a vehicle.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tagpoint Taxi Dispatch',
    short_name: 'Tagpoint',
    description: 'Ritten, check-in en registratie voor chauffeurs.',
    start_url: '/driver',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#1f47d6',
    lang: 'nl',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
