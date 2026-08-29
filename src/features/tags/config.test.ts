import { afterEach, describe, expect, it } from 'vitest';
import { isTagFeatureConfigured, isTemporaryHost } from './config';

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

describe('tijdelijk adres van de hostingpartij', () => {
  it('herkent het standaardadres van de hostingpartij', () => {
    expect(isTemporaryHost('https://astroholistic.vercel.app')).toBe(true);
    expect(isTemporaryHost('https://mijn-app.netlify.app')).toBe(true);
  });

  it('herkent een eigen domein als definitief', () => {
    expect(isTemporaryHost('https://taxi.tagpoint.nl')).toBe(false);
    expect(isTemporaryHost('https://vervoer.example.nl')).toBe(false);
  });

  it('een subdomein dat toevallig zo eindigt telt niet mee', () => {
    // `vercel.app.example.nl` is een eigen domein, geen hostingadres. Zoeken op
    // "bevat vercel.app" zou hier ten onrechte alarm slaan.
    expect(isTemporaryHost('https://vercel.app.example.nl')).toBe(false);
  });

  it('lokaal draaien telt als tijdelijk', () => {
    // Een tag die je thuis uitschrijft wijst naar localhost en werkt nergens.
    expect(isTemporaryHost('http://localhost:3000')).toBe(true);
    expect(isTemporaryHost('http://127.0.0.1:3000')).toBe(true);
  });

  it('een onleesbare waarde geeft de waarschuwing, niet de stilte', () => {
    expect(isTemporaryHost('geen-url')).toBe(true);
    expect(isTemporaryHost('')).toBe(true);
  });
});
