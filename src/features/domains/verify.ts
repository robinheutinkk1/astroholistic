import { verificationRecordName, verificationRecordValue } from './hostname';

/**
 * Deciding whether a tenant has proven control of a hostname.
 *
 * The proof is a TXT record only the domain's owner can publish. This module
 * is deliberately free of Node's DNS import and of `server-only`: the resolver
 * is a required parameter, so every branch below — including the awkward ones,
 * like a record that exists but carries someone else's token — is provable in
 * a unit test rather than only observable against live DNS.
 *
 * The live resolver lives in ./dns.
 */
export type TxtResolver = (name: string) => Promise<string[][]>;

export type VerificationOutcome =
  | { readonly verified: true }
  | { readonly verified: false; readonly reason: 'NO_RECORD' | 'TOKEN_MISMATCH' };

/**
 * A TXT record longer than 255 bytes arrives as several chunks that resolvers
 * hand back as an array. Joining them is how the record is meant to be read;
 * comparing chunk-by-chunk would fail on a record that is entirely correct.
 */
export function matchTxtRecords(
  records: readonly (readonly string[])[],
  token: string,
): VerificationOutcome {
  if (records.length === 0) return { verified: false, reason: 'NO_RECORD' };

  const expected = verificationRecordValue(token);
  const values = records.map((chunks) => chunks.join('').trim());

  return values.includes(expected)
    ? { verified: true }
    : { verified: false, reason: 'TOKEN_MISMATCH' };
}

export async function checkDomainToken(
  hostname: string,
  token: string,
  resolver: TxtResolver,
): Promise<VerificationOutcome> {
  let records: string[][];
  try {
    records = await resolver(verificationRecordName(hostname));
  } catch {
    // NXDOMAIN, SERVFAIL, timeout — all indistinguishable from "not published
    // yet" from the tenant's side, and all mean the same thing: not proven.
    return { verified: false, reason: 'NO_RECORD' };
  }
  return matchTxtRecords(records, token);
}
