# Tagpoint Taxi Dispatch

Multi-tenant SaaS-platform voor vervoersbedrijven: cliëntenbeheer, terugkerende
ritplanning, dispatching, een chauffeurs-PWA met NFC/QR check-in, en portalen
voor cliënten, contactpersonen en opdrachtgevers.

> **Status: alle veertien fasen afgerond.** Het platform is functioneel
> compleet en gedocumenteerd; wat er nog niet is, staat expliciet in
> [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §14 en
> [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md).
>
> `npm run verify` groen (320 tests) · `npm run test:security` groen (385 tests)
> · `npm run test:e2e` 34 geslaagd, 12 overgeslagen zonder authenticatiedienst.

## Documentatie

| Document                                                         | Inhoud                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| [`docs/AUDIT_PHASE0.md`](docs/AUDIT_PHASE0.md)                   | Repository-audit — uitgangssituatie                     |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                   | Systeemarchitectuur, mappenstructuur, technologiekeuzes |
| [`docs/DATABASE.md`](docs/DATABASE.md)                           | ER-model, tabellen, constraints, indexes                |
| [`docs/SECURITY.md`](docs/SECURITY.md)                           | Dreigingsmodel, RLS-strategie, GDPR, testmatrix         |
| [`docs/ROLES_AND_PERMISSIONS.md`](docs/ROLES_AND_PERMISSIONS.md) | RBAC-model en permissiecatalogus                        |
| [`docs/NFC.md`](docs/NFC.md)                                     | Tagpoint tag/QR-ontwerp en check-in flow                |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)     | Fasering en Definition of Done                          |
| [`docs/RISKS_AND_DECISIONS.md`](docs/RISKS_AND_DECISIONS.md)     | **Openstaande beslispunten en aannames**                |
| [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md)               | Beveiligingsaudit met bevindingen en openstaande gaten  |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)                       | Van leeg account naar productie, met rookproef          |
| [`docs/LOKAAL_DRAAIEN.md`](docs/LOKAAL_DRAAIEN.md)               | Stap voor stap draaien op je eigen pc                   |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)                     | Werkwijze, codeconventies, teststrategie                |

Begin bij `RISKS_AND_DECISIONS.md` als je wilt weten waar keuzes zijn gemaakt
die jou aangaan — en welke vragen nog openstaan.

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
- **White label.** Elke organisatie heeft een eigen naam, logo, kleuren en
  desgewenst een eigen domeinnaam — zichtbaar vóór het inloggen, ook voor een
  ouder die een link kreeg.
- **Support kan niets zien.** Medewerkers van het platform hebben geen toegang
  tot klantgegevens. De organisatie geeft die zelf tijdelijk, alleen-lezen, en
  ziet in haar eigen logboek wat er gebeurd is.

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
npm run dev              # http://localhost:3000
npm run verify           # format, typegen, lint, typecheck, test, build — als CI
npm run test:security    # tenant-isolatie, tegen een lokale PostgreSQL
npm run test:e2e         # end-to-end in een echte browser
npm run perf             # volumetest — WIST de lokale database
```

Deployen? [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), en draai
`npm run check:env:production` voordat je iets aanzet.

Zie [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) voor de rest.

## Licentie

Propriëtair. Alle rechten voorbehouden.
