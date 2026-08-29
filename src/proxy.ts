import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env';
import { buildCsp, generateNonce } from '@/lib/security/csp';
import {
  IDLE_LIMIT_SECONDS,
  LAST_SEEN_COOKIE,
  isExemptFromTimeout,
  isIdleExpired,
  stamp,
} from '@/lib/security/session-timeout';

/**
 * Proxy (formerly "middleware") refreshes the Supabase session cookie and
 * handles routing. Next 16 renamed the file convention; the role is unchanged.
 *
 * It is NOT an authorisation layer (masterprompt §58, docs/SECURITY.md §4).
 * Every page and action re-checks permissions server-side, and RLS enforces the
 * tenant boundary regardless. This layer only decides where to send a browser.
 */
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth',
  /** NFC/QR landing must be reachable signed-out — a tap just opens a browser.
   *  The page itself shows no personal data to anonymous visitors (docs/NFC.md §5). */
  '/t',
  /**
   * API routes do their own authentication and must answer with a status code,
   * not an HTML redirect. Without this the nightly cron job — which
   * authenticates with a shared secret, not a session — would be redirected to
   * the login page and silently never run.
   */
  '/api',
];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  // The nonce goes onto the *request* headers before Next renders, which is how
  // Next learns to stamp it on its own inline bootstrap script, and onto the
  // response header so the browser accepts that script. Both halves are
  // required; either one alone produces a blank page.
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    development: process.env.NODE_ENV !== 'production',
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set('content-security-policy', csp);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase. getSession() only reads the
  // cookie, which a client can forge, so it must not be used here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    const redirect = NextResponse.redirect(loginUrl);
    redirect.headers.set('content-security-policy', csp);
    return redirect;
  }

  /*
   * De inactiviteitsklok. Loopt niet in de chauffeursapp: die staat als PWA op
   * een eigen telefoon met een schermvergrendeling ervoor, en een chauffeur die
   * om zes uur 's ochtends met handschoenen aan opnieuw moet inloggen registreert
   * uiteindelijk niets meer. Zie src/lib/security/session-timeout.ts.
   */
  if (user && !isPublicPath(pathname) && !isExemptFromTimeout(pathname)) {
    const nowSeconds = Date.now() / 1000;
    const lastSeen = request.cookies.get(LAST_SEEN_COOKIE)?.value;

    if (isIdleExpired(lastSeen, nowSeconds)) {
      // Echt uitloggen en niet alleen doorsturen: anders blijft de sessie bij
      // Supabase gewoon geldig en is één stap terug genoeg om er weer in te
      // zitten.
      await supabase.auth.signOut();

      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('reden', 'verlopen');
      const redirect = NextResponse.redirect(loginUrl);
      redirect.headers.set('content-security-policy', csp);
      redirect.cookies.delete(LAST_SEEN_COOKIE);
      return redirect;
    }

    response.cookies.set(LAST_SEEN_COOKIE, stamp(nowSeconds), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // Iets langer dan de limiet, zodat het verschil tussen "verlopen" en
      // "cookie weg" niet van de browser afhangt.
      maxAge: IDLE_LIMIT_SECONDS * 2,
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets. Keeping images and fonts out of the
     * matcher avoids a pointless auth round-trip on every asset request.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
};
