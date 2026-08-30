import { describe, expect, it } from 'vitest';
import { AUDIT_ACTION_LABELS, auditActionLabel } from './labels';

describe('de labels van het logboek', () => {
  it('elke bekende actie heeft een niet-lege Nederlandse naam', () => {
    // De volledigheid zelf wordt door het type afgedwongen; dit vangt een
    // leeg of per ongeluk Engels label.
    for (const [action, label] of Object.entries(AUDIT_ACTION_LABELS)) {
      expect(label.length, action).toBeGreaterThan(3);
      expect(label, action).not.toMatch(/^[a-z_.]+$/);
    }
  });

  it('een actie van voor de laatste release toont zijn ruwe naam, geen lege cel', () => {
    // Het logboek is ouder dan de code die hem leest, per definitie.
    expect(auditActionLabel('legacy.verdwenen_actie')).toBe('legacy.verdwenen_actie');
  });
});
