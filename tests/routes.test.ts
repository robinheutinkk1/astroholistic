import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Elke interne link moet ergens uitkomen.
 *
 * WAAROM DIT BESTAAT. De zijbalk verwees maandenlang naar `/opdrachtgevers`,
 * een pagina die niet bestond. Iedereen die erop klikte kreeg een 404, en
 * niemand merkte het — er was geen scherm om naartoe te gaan, dus niemand
 * klikte er in ontwikkeling ooit op.
 *
 * TypeScript ving het niet: `href` in de navigatiedefinitie is een gewone
 * string, en de `Route`-typen van Next dekken alleen JSX-links, niet een
 * lijstje met paden in een array.
 *
 * Deze test leest de routes uit de bestandsstructuur en vergelijkt ze met elke
 * hard ingetypte link in de broncode.
 */

const APP_DIR = join(process.cwd(), 'src', 'app');
const SRC_DIR = join(process.cwd(), 'src');

/** De routes die de App Router daadwerkelijk oplevert. */
function collectRoutes(dir: string, segments: string[] = []): string[] {
  const routes: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) {
      // Een map is pas een route als er een page of een route handler in zit.
      if (/^(page|route)\.tsx?$/.test(entry)) {
        routes.push('/' + segments.join('/'));
      }
      continue;
    }

    // Routegroepen zoals (org) zitten niet in de URL. Privémappen (_naam)
    // leveren helemaal geen route op.
    if (entry.startsWith('_')) continue;
    const isGroup = entry.startsWith('(') && entry.endsWith(')');
    routes.push(...collectRoutes(full, isGroup ? segments : [...segments, entry]));
  }

  return routes;
}

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const ROUTES = collectRoutes(APP_DIR);

/** Past dit pad op een route, ook als die een [parameter] bevat? */
function matches(path: string): boolean {
  const parts = path.split('/').filter(Boolean);

  return ROUTES.some((route) => {
    const routeParts = route.split('/').filter(Boolean);
    // Een catch-all vangt alles wat erachter komt.
    const catchAll = routeParts.at(-1)?.startsWith('[...');
    if (!catchAll && routeParts.length !== parts.length) return false;
    if (catchAll && parts.length < routeParts.length - 1) return false;

    return routeParts.every((routePart, index) => {
      if (routePart.startsWith('[')) return true;
      return routePart === parts[index];
    });
  });
}

/**
 * Links met een variabele erin (`/clienten/${id}`) worden teruggebracht tot de
 * vorm die de router ziet. De waarde doet er niet toe, het pad wel.
 */
function normalize(href: string): string {
  return (
    href
      .replace(/\$\{[^}]*\}/g, ':param')
      .split('?')[0]!
      .split('#')[0]!
      .replace(/\/$/, '') || '/'
  );
}

describe('interne links', () => {
  it('vindt de routes van de applicatie', () => {
    // Een vangnet onder het vangnet: als collectRoutes stukgaat en niets
    // teruggeeft, zou elke andere assertie hieronder slagen zonder te kijken.
    expect(ROUTES.length).toBeGreaterThan(20);
    expect(ROUTES).toContain('/login');
    expect(ROUTES).toContain('/dashboard');
  });

  it('wijst elke href naar een bestaande route', () => {
    const dead: string[] = [];

    for (const file of sourceFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      // href="/pad" en href={`/pad/${id}`}, plus de href-velden in de
      // navigatiedefinitie (href: '/pad').
      const pattern = /href[=:]\s*[{"'`]*\s*[`'"](\/[^`'"\s]*)[`'"]/g;

      for (const match of content.matchAll(pattern)) {
        const path = normalize(match[1]!);
        // Externe bestanden en API-routes met een eigen handler slaan we over
        // als ze op een bestandsextensie eindigen.
        if (/\.[a-z0-9]+$/i.test(path)) continue;
        if (!matches(path)) dead.push(`${relative(process.cwd(), file)} → ${path}`);
      }
    }

    expect(dead, `Deze links komen nergens uit:\n${dead.join('\n')}`).toEqual([]);
  });

  it('wijst elke redirect naar een bestaande route', () => {
    const dead: string[] = [];

    for (const file of sourceFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(/redirect\(\s*[`'"](\/[^`'"\s]*)[`'"]/g)) {
        const path = normalize(match[1]!);
        if (!matches(path)) dead.push(`${relative(process.cwd(), file)} → ${path}`);
      }
    }

    expect(dead, `Deze redirects komen nergens uit:\n${dead.join('\n')}`).toEqual([]);
  });
});
