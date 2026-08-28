# Ontwikkelen aan TagPoint Taxi Dispatch

## Vereisten

| Tool | Versie | Waarom |
|---|---|---|
| Node.js | 22 of hoger | Next 16 vereist het |
| npm | 10+ | Lockfile v3 |
| Docker | draaiend | Voor de lokale Supabase-stack |

Je hebt **geen** Supabase-cloudproject nodig om te ontwikkelen of te testen.

## Starten

```bash
npm install
cp .env.example .env.local     # placeholders volstaan tot Fase 2
npm run dev                    # http://localhost:3000
```

## Commando's

| Commando | Doet |
|---|---|
| `npm run dev` | Ontwikkelserver |
| `npm run verify` | **Alles wat CI ook draait**: format, lint, typecheck, test, build |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` / `test:watch` | Vitest |
| `npm run format` | Prettier |
| `npm run db:start` / `db:stop` | Lokale Supabase-stack (Docker) |
| `npm run db:reset` | Database leegmaken en alle migrations opnieuw draaien |
| `npm run db:types` | `src/types/database.ts` genereren (Supabase CLI, gezaghebbend) |
| `npm run db:types:local` | Idem, via introspectie — voor omgevingen zonder Docker |
| `npm run db:test` | pgTAP-tests (RLS en constraints) |

Draai `npm run verify` vóór elke push. Het is dezelfde keten als CI, dus als het
lokaal groen is, is het dat in CI ook.

## Versiekeuzes die uitleg verdienen

**TypeScript 6.0.3, niet 7.** TypeScript 7 (de Go-herschrijving) is uit, maar
`typescript-eslint` ondersteunt hem nog niet. Upgraden zou betekenen dat we de
type-aware lintregels verliezen — juist de regels die de "geen `any`"-afspraak
uit §67.9 afdwingen. Zodra `typescript-eslint` TS 7 ondersteunt, is dit een
kwestie van het versienummer ophogen.

**Next 16 gebruikt `src/proxy.ts`, niet `src/middleware.ts`.** Next 16 heeft de
bestandsconventie hernoemd. De rol is ongewijzigd: sessie verversen en routeren,
**geen** autorisatie.

## Architectuurregels die CI afdwingt

Deze staan niet alleen in de documentatie — ESLint blokkeert ze. Geverifieerd
met testprobes tijdens Fase 1:

| Regel | Wat er gebeurt |
|---|---|
| Service-role client importeren buiten `lib/supabase/admin.ts` | Lintfout |
| Component die `repository.ts` importeert | Lintfout |
| Hardcoded UUID in de broncode | Lintfout |
| `any` gebruiken | Lintfout |
| Niet-afgehandelde promise | Lintfout |

De service-role regel geldt óók voor legitieme server-services. Dat is opzet: wie
hem nodig heeft, schrijft een expliciete `// eslint-disable-next-line` met een
reden erbij, zodat het in de pull request zichtbaar is in plaats van te verdwijnen
in een diff.

## Mappenstructuur

Zie `ARCHITECTURE.md` §4. De belangrijkste regel per feature-module:

```
features/<domein>/
├── schema.ts        Zod-validatie — de enige plek waar input wordt gevalideerd
├── repository.ts    Data; kent PostgREST, kent geen businessregels
├── service.ts       Businessregels + permissiechecks; kent geen React en geen HTTP
├── actions.ts       Server Actions — dun: auth → validatie → service
├── components/      React
└── __tests__/
```

`actions.ts` bevat geen businesslogica. `components/` roept nooit `repository.ts`
aan. Beide worden door ESLint bewaakt.

## Tests

| Soort | Locatie | Draait met |
|---|---|---|
| Unit / component | naast de code, `*.test.ts(x)` | `npm run test` |
| RLS / policies | `supabase/tests/` (pgTAP) | `npm run db:test` |
| Tenant-isolatie | `tests/security/` | vanaf Fase 2 |
| E2E | `tests/e2e/` | vanaf Fase 6 |

De tenant-isolatietests zitten bewust **niet** in de standaard `npm run test`:
ze hebben een draaiende lokale database nodig, en een unit-testrun die faalt
omdat Docker uit staat leert niemand iets. In CI draaien ze als aparte stap.

## Git

`main` ← `develop` ← `feature/*`. Conventional commits (`feat:`, `fix:`,
`docs:`, `test:`, `chore:`, `refactor:`). CI moet groen zijn voor een merge;
vanaf Fase 2 blokkeert ook de beveiligingstestsuite.
