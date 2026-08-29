import 'server-only';
import { headers } from 'next/headers';
/*
 * The fifth legitimate service-role job (see src/lib/supabase/admin.ts).
 *
 * Rate limiting holds no tenant data — that is exactly why it may not go
 * through a user's session. The limiter has to work for an anonymous visitor
 * on the login form, and `public.consume_rate_limit` is granted to the service
 * role only so that nobody can call it directly to burn someone else's
 * allowance (migration 0023).
 */
// eslint-disable-next-line no-restricted-imports
import { createUnscopedAdminClient } from '@/lib/supabase/admin';

/**
 * How much of what, per window.
 *
 * These live in code rather than as parameters from the caller, and the SQL
 * function is unreachable except through this module. The numbers are a
 * judgement: generous enough that a person who forgets their password twice is
 * never inconvenienced, tight enough that a script is.
 */
export const RATE_LIMITS = {
  /** Sign-in attempts from one address. */
  'login-ip': { limit: 20, windowSeconds: 900 },
  /** Sign-in attempts against one account, wherever they come from. */
  'login-account': { limit: 8, windowSeconds: 900 },
  /** Password-reset mails. Each one sends e-mail to a third party. */
  'password-reset-ip': { limit: 6, windowSeconds: 3600 },
  'password-reset-account': { limit: 4, windowSeconds: 3600 },
  /** Portal writes: absence reports and change requests. */
  'portal-write': { limit: 40, windowSeconds: 3600 },
  /** Exports take personal data out of the system. */
  'report-export': { limit: 30, windowSeconds: 3600 },
  /**
   * Uitnodigingen, per organisatie. Elke uitnodiging stuurt post naar een
   * derde; het adres van de uitnodiger is hier geen zinnig anker, want een
   * planner nodigt zijn hele ploeg vanaf hetzelfde kantoor uit.
   */
  'member-invite': { limit: 25, windowSeconds: 3600 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

/**
 * The caller's address, as far as we can tell.
 *
 * `x-forwarded-for` is set by the proxy in front of the app and is only
 * trustworthy because of that — a request that reaches the app directly can
 * claim anything. That is acceptable here: this is abuse control, not
 * authorisation, and the account-scoped limit below covers the case where the
 * address is worthless.
 */
async function callerAddress(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first && first.length > 0 ? first : (headerList.get('x-real-ip') ?? 'unknown');
}

/**
 * Records an attempt and says whether it may proceed.
 *
 * FAILS OPEN. If the database is unreachable the limiter returns `true` rather
 * than locking every user out of the product: a rate limiter that becomes an
 * outage is a worse failure than the one it prevents. The failure is logged
 * loudly, because silently unlimited is not a state anyone should discover
 * from an incident.
 */
export async function consume(
  bucket: RateLimitBucket,
  subject: string,
): Promise<boolean> {
  const { limit, windowSeconds } = RATE_LIMITS[bucket];

  try {
    const admin = createUnscopedAdminClient(
      'rate limiting: shared counters, no tenant data, must work for anonymous callers',
    );
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_bucket: bucket,
      p_subject: subject,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error('Rate limiter unavailable; allowing the request', {
        bucket,
        code: error.code,
      });
      return true;
    }
    return data !== false;
  } catch (error) {
    console.error('Rate limiter threw; allowing the request', {
      bucket,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return true;
  }
}

/** Both the address limit and the account limit. Either one can refuse. */
export async function consumeForAccount(
  ipBucket: RateLimitBucket,
  accountBucket: RateLimitBucket,
  account: string,
): Promise<boolean> {
  const address = await callerAddress();
  // Both are consumed, deliberately, rather than short-circuiting: an attacker
  // who trips the account limit should still burn their address allowance.
  const [byAddress, byAccount] = await Promise.all([
    consume(ipBucket, address),
    consume(accountBucket, account.trim().toLowerCase()),
  ]);
  return byAddress && byAccount;
}

export async function consumeForCaller(bucket: RateLimitBucket): Promise<boolean> {
  return consume(bucket, await callerAddress());
}

export async function consumeForUser(
  bucket: RateLimitBucket,
  userId: string,
): Promise<boolean> {
  return consume(bucket, userId);
}
