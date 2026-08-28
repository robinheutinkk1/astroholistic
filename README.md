# TagPoint Taxi Dispatch

Multi-tenant SaaS-platform voor vervoersbedrijven: cliëntenbeheer, terugkerende
ritplanning, dispatching, een chauffeurs-PWA met NFC/QR check-in, en portalen
voor cliënten, contactpersonen en opdrachtgevers.

> **Status: Fase 8 afgerond** — het dispatchbord werkt en werkt zichzelf live
> bij. `npm run verify` groen (174 tests), `npm run test:security` groen
> (205 tests). De portalen voor cliënt, ouder en opdrachtgever volgen in Fase 9.

## Documentatie

| Document                                                         | Inhoud                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| [`docs/AUDIT_PHASE0.md`](docs/AUDIT_PHASE0.md)                   | Repository-audit — uitgangssituatie                     |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                   | Systeemarchitectuur, mappenstructuur, technologiekeuzes |
| [`docs/DATABASE.md`](docs/DATABASE.md)                           | ER-model, tabellen, constraints, indexes                |
| [`docs/SECURITY.md`](docs/SECURITY.md)                           | Dreigingsmodel, RLS-strategie, GDPR, testmatrix         |
| [`docs/ROLES_AND_PERMISSIONS.md`](docs/ROLES_AND_PERMISSIONS.md) | RBAC-model en permissiecatalogus                        |
| [`docs/NFC.md`](docs/NFC.md)                                     | TagPoint tag/QR-ontwerp en check-in flow                |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)     | Fasering en Definition of Done                          |
| [`docs/RISKS_AND_DECISIONS.md`](docs/RISKS_AND_DECISIONS.md)     | **Openstaande beslispunten en aannames**                |

`DEPLOYMENT.md` volgt in Fase 14.

## Kernpunten

- **Multi-tenant vanaf de database.** Isolatie wordt afgedwongen met PostgreSQL
  Row Level Security, niet met frontendfilters. Taxi Ontzorgd is één organisatie
  binnen het platform, geen speciaal geval in de code.
- **Databasegedreven RBAC.** Geen `if (user.role === 'admin')`; permissies zijn
  data, rollen zijn per organisatie samen te stellen.
- **Privacy by design.** Data-minimalisatie, geen medisch dossier, geen
  persoonsgegevens in publieke NFC-URL's, geen persoonsgegevens in logs.
- **NFC en QR zijn één systeem.** Eén tag, één token, één statusmodel, één
  check-in flow.
- **Gebouwd voor groepsvervoer.** Meerdere cliënten bij één locatie zijn één
  busrit met één stop: de chauffeur drukt één keer op "aangekomen" en checkt
  daarna iedereen in. Capaciteit wordt getoetst op piekbezetting, niet op
  hoofdental.

## Techniek

Next.js 16 · React 19 · TypeScript 6 (strict) · Tailwind CSS v4 ·
Supabase (PostgreSQL, Auth, Realtime, Storage) · Vercel · PWA

## Aan de slag

**Voor het eerst? Volg [`docs/LOKAAL_DRAAIEN.md`](docs/LOKAAL_DRAAIEN.md)** —
stap voor stap, inclusief wat je moet installeren en waarmee je inlogt.

Kort samengevat: Node 22 en Docker zijn genoeg. Een Supabase-cloudproject is **niet** nodig om te
ontwikkelen of te testen — de CLI draait de hele stack lokaal.

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm run verify     # format, lint, typecheck, test, build — hetzelfde als CI
```

Zie [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) voor de rest.

## Licentie

Propriëtair. Alle rechten voorbehouden.
