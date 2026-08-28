import { afterEach, describe, expect, it } from 'vitest';
import { isTagFeatureConfigured } from './config';

/**
 * De configuratiecontrole die het verschil maakt tussen "er ging iets mis" en
 * een melding waar iemand iets mee kan.
 */
const ORIGINAL = process.env['TAG_TOKEN_PEPPER'];

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env['TAG_TOKEN_PEPPER'];
  else process.env['TAG_TOKEN_PEPPER'] = ORIGINAL;
});

describe('isTagFeatureConfigured', () => {
  it('is false zonder pepper', () => {
    delete process.env['TAG_TOKEN_PEPPER'];
    expect(isTagFeatureConfigured()).toBe(false);
  });

  it('is false bij een te korte pepper', () => {
    // Precies het geval dat een generieke fout opleverde: wél ingevuld, maar
    // niet bruikbaar. Zonder deze controle lijkt de configuratie in orde.
    process.env['TAG_TOKEN_PEPPER'] = 'te-kort';
    expect(isTagFeatureConfigured()).toBe(false);
  });

  it('is true bij een bruikbare pepper', () => {
    process.env['TAG_TOKEN_PEPPER'] = 'x'.repeat(48);
    expect(isTagFeatureConfigured()).toBe(true);
  });
});
