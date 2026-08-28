import { describe, expect, it, vi } from 'vitest';
import { checkDomainToken, matchTxtRecords } from './verify';

const TOKEN = 'd41d8cd98f00b204e9800998ecf8427e';

describe('matchTxtRecords', () => {
  it('accepts the exact record', () => {
    expect(matchTxtRecords([[`tagpoint-domain-verification=${TOKEN}`]], TOKEN)).toEqual({
      verified: true,
    });
  });

  it('joins a chunked record before comparing', () => {
    // Resolvers split TXT strings over 255 bytes. A correct record must not
    // fail because of how it arrived.
    expect(
      matchTxtRecords([['tagpoint-domain-', `verification=${TOKEN}`]], TOKEN),
    ).toEqual({ verified: true });
  });

  it('finds the record among unrelated ones', () => {
    expect(
      matchTxtRecords(
        [
          ['v=spf1 include:_spf.example.nl ~all'],
          [`tagpoint-domain-verification=${TOKEN}`],
        ],
        TOKEN,
      ),
    ).toEqual({ verified: true });
  });

  it('rejects an empty answer', () => {
    expect(matchTxtRecords([], TOKEN)).toEqual({
      verified: false,
      reason: 'NO_RECORD',
    });
  });

  it("rejects another organisation's token on the same name", () => {
    // The whole point of the check. Publishing *a* verification record is not
    // proof; publishing *this* one is.
    expect(
      matchTxtRecords([['tagpoint-domain-verification=someone-elses-token']], TOKEN),
    ).toEqual({ verified: false, reason: 'TOKEN_MISMATCH' });
  });

  it('rejects a bare token without the prefix', () => {
    // Without the prefix, any site that happens to publish a hex string on
    // that name would pass.
    expect(matchTxtRecords([[TOKEN]], TOKEN)).toEqual({
      verified: false,
      reason: 'TOKEN_MISMATCH',
    });
  });

  it('rejects a record that merely contains the token', () => {
    expect(
      matchTxtRecords([[`prefix tagpoint-domain-verification=${TOKEN} suffix`]], TOKEN),
    ).toEqual({ verified: false, reason: 'TOKEN_MISMATCH' });
  });

  it('tolerates surrounding whitespace, which DNS panels often add', () => {
    expect(
      matchTxtRecords([[`  tagpoint-domain-verification=${TOKEN}  `]], TOKEN),
    ).toEqual({ verified: true });
  });
});

describe('checkDomainToken', () => {
  it('queries the dedicated verification name', async () => {
    const resolver = vi
      .fn()
      .mockResolvedValue([[`tagpoint-domain-verification=${TOKEN}`]]);

    await checkDomainToken('vervoer.voorbeeld.nl', TOKEN, resolver);

    expect(resolver).toHaveBeenCalledWith('_tagpoint-verify.vervoer.voorbeeld.nl');
  });

  it('treats a resolver failure as "not proven" rather than throwing', async () => {
    // A tenant who has not published the record yet gets NXDOMAIN. That is the
    // normal path through this code, not an exception.
    const resolver = vi.fn().mockRejectedValue(new Error('queryTxt ENOTFOUND'));

    await expect(checkDomainToken('voorbeeld.nl', TOKEN, resolver)).resolves.toEqual({
      verified: false,
      reason: 'NO_RECORD',
    });
  });
});
