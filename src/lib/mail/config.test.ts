import { describe, expect, it } from 'vitest';
import { resolveMailConfig } from './config';

describe('de mailconfiguratie', () => {
  const COMPLETE = {
    MAIL_PROVIDER: 'resend',
    MAIL_API_KEY: 're_123',
    MAIL_FROM: 'Tagpoint <noreply@taxi.tagpoint.nl>',
  };

  it('compleet is compleet', () => {
    const result = resolveMailConfig(COMPLETE);
    expect(result.configured).toBe(true);
    if (result.configured) expect(result.config.from).toContain('@');
  });

  it('geen provider is een geldige toestand met een leesbare reden', () => {
    // Een verse installatie draait zonder mailkanaal; de reden komt in het
    // logboek van de hosting, dus hij moet een mens iets vertellen.
    const result = resolveMailConfig({});
    expect(result.configured).toBe(false);
    if (!result.configured) expect(result.reason).toContain('MAIL_PROVIDER');
  });

  it('elke ontbrekende helft heeft zijn eigen reden', () => {
    for (const [drop, expected] of [
      ['MAIL_API_KEY', 'MAIL_API_KEY'],
      ['MAIL_FROM', 'MAIL_FROM'],
    ] as const) {
      const env: Record<string, string | undefined> = { ...COMPLETE };
      delete env[drop];
      const result = resolveMailConfig(env);
      expect(result.configured).toBe(false);
      if (!result.configured) expect(result.reason).toContain(expected);
    }
  });

  it('een afzender zonder e-mailadres wordt hier geweigerd, niet per bericht bij de provider', () => {
    const result = resolveMailConfig({ ...COMPLETE, MAIL_FROM: 'alleen een naam' });
    expect(result.configured).toBe(false);
  });

  it('een onbekende provider noemt zichzelf in de reden', () => {
    const result = resolveMailConfig({ ...COMPLETE, MAIL_PROVIDER: 'duiventil' });
    expect(result.configured).toBe(false);
    if (!result.configured) expect(result.reason).toContain('duiventil');
  });
});
