# Fase 0 — Repository audit

**Datum:** 2026-08-27
**Repository:** `robinheutinkk1/astroholistic`
**Branch:** `claude/tagpoint-taxi-dispatch-d69dpb`

---

## 1. Bevinding: de repository is volledig leeg

De audit is uitgevoerd op de daadwerkelijke checkout. Resultaat:

| Controle | Commando | Resultaat |
|---|---|---|
| Werkdirectory | `ls -la` | Alleen `.git/` — geen enkel bestand |
| Commits | `git log` | `fatal: does not have any commits yet` |
| Git objecten | `git count-objects -v` | `count: 0`, `in-pack: 0` |
| Remote branches | `git ls-remote --heads origin` | Leeg — geen enkele branch op GitHub |
| Remote refs (incl. tags) | `git ls-remote origin` | Leeg |

**Conclusie: er is geen bestaande codebase.** Dit is een greenfield project.

## 2. Wat dit betekent voor het gevraagde auditplan

Het masterprompt (§66, Fase 0) vroeg om analyse van:

| Gevraagd | Aangetroffen |
|---|---|
| `package.json` | Bestaat niet |
| Next.js versie | Niet aanwezig |
| Bestaande componenten | Niet aanwezig |
| Supabase configuratie | Niet aanwezig |
| Environment variables | Niet aanwezig (geen `.env*`) |
| Huidige database | Geen migrations, geen `supabase/` map |
| Bestaande routes | Niet aanwezig |
| Bestaande TagPoint functionaliteit | Niet aanwezig |

Regel §67.1 ("breek geen bestaande functionaliteit") is daarmee niet van toepassing:
er is niets om te breken en niets om te behouden. Dat is gunstig — we kunnen de
architectuur schoon neerzetten zonder legacy-compromissen.

## 3. Punt van aandacht: repositorynaam

De repository heet `astroholistic`. Het product heet **TagPoint Taxi Dispatch**.
Er is geen inhoudelijke relatie tussen die twee namen en er staat geen
`astroholistic`-code in de repo.

**Advies:** hernoem de repository naar bijvoorbeeld `tagpoint-taxi-dispatch`
vóór de eerste externe developer of klant meekijkt. Dit is puur cosmetisch en
blokkeert niets, maar een SaaS-product dat commercieel verkocht wordt hoort niet
in een repo met een niet-gerelateerde naam. Zie ook `docs/RISKS_AND_DECISIONS.md`
(besluit D-01).

## 4. Beschikbare toolchain in de ontwikkelomgeving

Geverifieerd in deze sessie:

| Tool | Versie | Status |
|---|---|---|
| Node.js | v22.22.2 | Beschikbaar — voldoet aan Next.js 15 |
| npm | 10.9.7 | Beschikbaar |
| Docker | 29.3.1 | Beschikbaar — nodig voor lokale Supabase stack |
| Supabase CLI | — | **Niet geïnstalleerd** |

De Supabase CLI wordt in Fase 1 als dev-dependency toegevoegd (`npm i -D supabase`)
in plaats van globaal geïnstalleerd, zodat de versie in Git vastligt en elke
developer en CI-run dezelfde CLI-versie gebruikt. Dat is nodig om §40
(reproduceerbare migrations) te kunnen garanderen.

Er bestaat nog **geen Supabase-cloudproject** (bevestigd door de opdrachtgever).
Dat blokkeert de bouw niet: `supabase start` draait de volledige stack lokaal in
Docker, en Fase 1 t/m 13 worden daarop ontwikkeld en getest. Het cloudproject is
pas in Fase 14 nodig, waar dezelfde migrations worden uitgerold.

## 5. Uitgangspositie

Er is dus geen brownfield-migratie nodig. De volgorde uit §66 blijft gelden,
maar Fase 0 levert geen "wat staat er al"-rapport op — het levert een
architectuurvoorstel op dat vanaf nul wordt neergezet.

De documenten die in deze fase zijn opgeleverd staan in `docs/`:

- `ARCHITECTURE.md` — systeemarchitectuur, mappenstructuur, laagindeling
- `DATABASE.md` — ER-model, tabellen, constraints, indexes
- `SECURITY.md` — dreigingsmodel, RLS-strategie, GDPR
- `ROLES_AND_PERMISSIONS.md` — RBAC-model en volledige permissiecatalogus
- `NFC.md` — TagPoint tag/QR-ontwerp en check-in flow
- `IMPLEMENTATION_PLAN.md` — fasering met Definition of Done per fase
- `RISKS_AND_DECISIONS.md` — expliciete beslispunten die bevestiging vragen
