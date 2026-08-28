# Implementatieplan

> Fasering volgens §66. Elke fase eindigt met een werkende, getoetste staat —
> niet met een half afgebouwde volgende fase.

## Definition of Done (§68)

Een feature is klaar als **alle** punten afgevinkt zijn:

- [ ] Migration geschreven en `supabase db reset` slaagt vanaf leeg
- [ ] RLS-policies aanwezig, met tests
- [ ] Autorisatie in de service-laag (`requirePermission`)
- [ ] Frontend af, inclusief error-, loading- en empty-states
- [ ] Mobiel gedrag gecontroleerd (chauffeursflows op een echt toestelformaat)
- [ ] Tests geschreven en groen
- [ ] `npm run lint` en `npm run build` slagen
- [ ] Documentatie in `docs/` bijgewerkt
- [ ] Auditlogging waar de actie dat vereist (§37)

"De pagina werkt" is niet klaar.

---

## Fase 0 — Audit ✅ afgerond

Repository-audit (`AUDIT_PHASE0.md`), architectuurdocumenten, ER-model,
permissiemodel, beslispunten (`RISKS_AND_DECISIONS.md`).

Besluiten D-02 en D-03 zijn op 2026-08-28 genomen; zie
`RISKS_AND_DECISIONS.md`.

---

## Fase 1 — Projectfundament ✅ afgerond

Opgeleverd:

- Next 16 (App Router), React 19, TypeScript 6 strict — inclusief
  `noUncheckedIndexedAccess` en `exactOptionalPropertyTypes`
- Tailwind v4 met design tokens als CSS custom properties, zodat white-label
  kleuren per tenant runtime kunnen wisselen zonder rebuild
- ESLint met de architectuurregels als **afdwingbare** lintregels: import van de
  service-role client, import van `repository.ts` vanuit componenten, hardcoded
  UUID's, `any`, niet-afgehandelde promises — elk geverifieerd met een testprobe
- Supabase-clients: browser, server (RLS actief) en admin (achter `server-only`,
  met een `withOrganizationScope`-wrapper die een organisatie-id afdwingt)
- Foutafhandeling (`AppError`-hiërarchie) en `Result<T, E>`
- Tijdzonehelpers met DST-correcte conversie (besluit D-07)
- Ritstatus-state machine (§61) — vooruitgehaald uit Fase 5 omdat het pure,
  testbare logica is die de latere planningsfase derisked
- UI-primitives: Button (incl. 56px touch-variant voor chauffeurs), Badge, Card,
  Input, Field (met ARIA-bedrading), loading/empty/error states, RideStatusBadge
- CI-workflow, `supabase/`-structuur, `DEVELOPMENT.md`

_Status:_ `npm run verify` (format, lint, typecheck, test, build) groen,
74 tests.

Twee echte defecten die de tests in deze fase aan het licht brachten: de
DST-conversie koos bij de dubbele oktobernacht de verkeerde doorgang, en de
state machine bood `PROBLEM` aan als vervolgstatus op een rit die al `PROBLEM`
was. Beide zijn in de implementatie gecorrigeerd, niet in de test.

## Fase 2 — Database en RLS ✅ afgerond

**15 migrations, 36 tabellen, 111 policies, 96 beveiligingstests.**

Opgeleverd:

- Volledig schema volgens `DATABASE.md`: tenancy, RBAC, cliënten en relaties,
  vloot, locaties, ritten, terugkerende ritten, ride events, tags,
  auditlog, notificaties en wijzigingsverzoeken
- RLS aan op **elke** tabel, met policies per commando en een `with check` op
  elke insert en update
- `app`-helperfuncties, alle `security definer` met `set search_path = ''`
- De permissiecatalogus (54 permissies) en zes systeemrollen als data
- State machine in de database als trigger, naast de TypeScript-versie — een
  test bewijst dat beide identiek zijn
- Append-only handhaving op `ride_events` en `audit_logs` in drie lagen
- Escalatietriggers: cross-tenant rolinjectie, laatste eigenaar, eigen rollen
- Groepsvervoer (besluit D-17): `trips`, `trip_stops`, `trip_templates`,
  piekbezettingsberekening, en exclusion-constraints tegen dubbelgeboekte
  chauffeurs en voertuigen
- Seed data met twee organisaties, acht persona's en een echte busrit met vier
  passagiers (fictief)

_Verificatie:_ `npm run db:rebuild` slaagt vanaf een lege database.
`npm run test:security` is groen: 68 inbraakscenario's plus 10 structurele
garanties.

**De suite is gevalideerd met mutatietesten.** Zes beveiligingen zijn expres
uitgeschakeld om te controleren dat de tests dat vangen: `clients_select`
openzetten liet 12 tests falen, chauffeursisolatie 2, de append-only trigger 2,
de capaciteitscontrole 2, de dubbelboeking-constraint 1 en de trip-scoping 1.
Een suite die alleen "nul rijen" verwacht kan groen zijn zonder iets te bewijzen;
deze niet.

De suite is ook idempotent: drie runs achter elkaar leveren hetzelfde resultaat
en laten de data ongemoeid. Dat was aanvankelijk **niet** zo — één capaciteitstest
deed een echte commit, waardoor de tweede run faalde. Uitgestelde constraints
worden nu met `set constraints all immediate` binnen de transactie getoetst en
altijd teruggedraaid, met een testcase die op residu controleert.

Ook geverifieerd met `EXPLAIN`: de permissiecheck draait als `InitPlan` met
`loops=1`, dus één keer per query in plaats van één keer per rij.

## Fase 3 — Auth en RBAC ✅ afgerond

Opgeleverd:

- Inloggen, uitloggen, wachtwoord vergeten en resetten, plus de
  `/auth/callback`-route die e-maillinks inwisselt voor een sessie
- Profielpagina
- Organisatiecontext: een gebruiker kan bij meerdere organisaties horen en
  wisselt via een switcher. De keuze staat in een cookie, maar wordt alleen
  gehonoreerd als hij een actief lidmaatschap benoemt — een gemanipuleerde
  cookie selecteert niets
- App-shell met sidebar die per rol gefilterd wordt, gebruikersmenu en
  white-label kleuren server-side toegepast (geen flits van platformkleuren)
- Gebruikersbeheer: rollen toewijzen en leden schorsen, met de escalatieregels
  uit `ROLES_AND_PERMISSIONS.md` §8
- `requirePermission` / `PermissionGate`
- Databasetypes gegenereerd uit het echte schema (36 tabellen, 26 enums,
  inclusief foreign keys zodat geneste queries typeerbaar zijn)

_Verificatie:_ `npm run verify` groen (81 tests), `npm run test:security` groen
(107 tests). De draaiende app stuurt onbevoegde routes door naar `/login` met
terugkeerpad, en laat `/t/…` publiek — beide gecontroleerd tegen de dev-server.

**Beveiligingskeuzes met een test erachter:**

- De redirect na inloggen accepteert alleen relatieve paden. `//evil.example`
  is de subtiele: die begint met een `/` maar leest voor de browser als een
  ander domein. Zeven testgevallen dekken dit af — een open redirect op een
  inlogformulier is een klassieke phishingroute.
- Fout wachtwoord en onbekend account geven hetzelfde antwoord, en "wachtwoord
  vergeten" meldt altijd succes. Anders is het formulier een middel om te
  ontdekken welke e-mailadressen een account hebben.
- Je kunt je eigen rollen niet wijzigen en jezelf niet schorsen, en geen rol
  toekennen met meer rechten dan je zelf hebt. Geweigerd in de service én in
  RLS.

**Parity-test tegen stille drift.** De permissielijst bestaat twee keer: als
getypeerde constante (zodat een typefout een compileerfout wordt) en in de
database (die daadwerkelijk beslist). Lopen ze uiteen, dan weigert een
permissie stilzwijgend alles zonder foutmelding. Vier tests bewaken de
gelijkheid in beide richtingen; beide mutaties zijn gecontroleerd.

**Bekende beperking van deze omgeving:** het daadwerkelijke inloggen kon hier
niet end-to-end getest worden, omdat Supabase Auth (GoTrue) een Docker-image
nodig heeft dat door het egress-beleid geblokkeerd is. Getest is: de routering,
de redirects, de permissielogica tegen de echte database, en de
formuliervalidatie. Op een omgeving met `npm run db:start` is de inlogflow wel
end-to-end te doorlopen — dat is de eerste controle die daar hoort te gebeuren.

## Fase 4 — Beheer-core

Dashboard met dagcijfers; CRUD voor cliënten, contacten, opdrachtgevers,
chauffeurs, voertuigen, locaties; server-side paginatie, filtering en sortering
vanaf het begin (§49); auditlogging op alle mutaties.

## Fase 5 — Ritten en planning

Ritten-CRUD; terugkerende templates; generatiejob met idempotentie; dag- en
weekplanning; chauffeur- en voertuigtoewijzing; uitzonderingen, annulering,
extra ritten; state machine in service én databasetrigger; conflictdetectie
(dubbel geboekte chauffeur of voertuig).

## Fase 6 — Chauffeurs-PWA

Mobile-first "Vandaag"-scherm; ritdetail; navigatie-deeplink; grote knoppen voor
de hele flow (§24); afwezigheid met redenen; notities; probleemmelding;
optionele GPS-capture; manifest, service worker, installatie.

## Fase 7 — NFC en QR

Volgens `NFC.md`: tags aanmaken, tokenafgifte, koppelen/ontkoppelen, statussen,
vervangen, QR-rendering, bulk-PDF; `/t/[token]`-landingspagina; check-in RPC in
één transactie; duplicaathandling; rate limiting; volledige beveiligingstests.

## Fase 8 — Realtime dispatch

Dispatchscherm met live statussen; `useRideStream`-hook; gedebouncede
dashboardtellers; probleemsignalering.

## Fase 9 — Portalen

Cliënt-, contact- en opdrachtgeverportaal; `change_requests`-workflow met
beoordeling door planners; per-portaal beveiligingstests.

## Fase 10 — White label en domeinen

Brandinginstellingen met validatie; logo-upload; CSS-variabelen server-rendered;
`organization_domains` met verificatie; host-resolutie in middleware; Vercel
wildcard-configuratie.

## Fase 11 — Rapportages

Ritten per dag, afgerond/geannuleerd/afwezig, check-in-tijden,
chauffeurprestaties, cliënthistorie; CSV-export met auditlogging.

## Fase 12 — Hardening

Volledige beveiligingsaudit langs `SECURITY.md` §2; `support_access_grants`;
GDPR-export en -erasurepad; bewaartermijnen; security headers en CSP;
rate limiting overal; dependency-audit; penetratietest van de
tenant-isolatiegrens.

## Fase 13 — Testen en stabilisatie

Volledige suite; E2E van de kritieke paden (plannen → rijden → inchecken →
afronden); performancetest met realistisch volume (100 organisaties, 50.000
ritten, 500.000 events); queryplannen controleren op ontbrekende indexes.

## Fase 14 — Deployment

Vercel-productieproject; Supabase-productieproject; migrations; auth-redirect-
URL's; domeinen; PWA-verificatie op echte toestellen; monitoring en alerting;
`DEPLOYMENT.md` en `DEVELOPMENT.md`.

---

## Volgorde-afhankelijkheden

```
Fase 1 ─→ Fase 2 ─→ Fase 3 ─→ Fase 4 ─→ Fase 5 ─┬─→ Fase 6 ─→ Fase 7 ─→ Fase 8
                                                 └─→ Fase 9
                                    Fase 10 kan parallel aan 8/9
                                    Fase 11 na Fase 5
                                    Fase 12–14 als afsluiting
```

Fase 2 is de enige harde poort: zonder bewezen tenant-isolatie wordt er geen UI
gebouwd, omdat elke pagina die je daarna bouwt op die aanname rust.

## Git-workflow (§52)

`main` (productie) ← `develop` (integratie) ← `feature/*`.
Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
Eén fase = één of meer feature-branches, elk met een eigen PR.
CI moet groen zijn; de beveiligingstestsuite blokkeert de merge.
