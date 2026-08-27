# TagPoint Taxi Dispatch — Architectuur

> Status: **voorstel (Fase 0/1)** — nog niet geïmplementeerd.
> Wijzigingen aan dit document horen bij de PR die het gedrag verandert.

---

## 1. Wat we bouwen

TagPoint Taxi Dispatch is een **multi-tenant SaaS-platform** voor
vervoersbedrijven: cliëntenbeheer, terugkerende ritplanning, dispatching,
een chauffeurs-PWA met NFC/QR check-in, en portalen voor cliënten,
contactpersonen en opdrachtgevers.

Taxi Ontzorgd is **één organisatie binnen het platform**, niet het platform.
Er staat nergens een hardcoded organisatie, kleur, domein of businessregel die
specifiek is voor Taxi Ontzorgd. Alles wat per klant verschilt is data
(`organizations`, `organization_settings`, `organization_branding`), geen code.

## 2. Architectuurprincipes

Deze principes zijn bindend. Een PR die er tegenin gaat, moet dit document
eerst wijzigen.

1. **De database is de beveiligingsgrens.** Tenant-isolatie wordt afgedwongen
   met PostgreSQL Row Level Security. De frontend en de service-laag zijn
   *aanvullende* lagen, nooit de enige laag. Als iemand met een geldig
   gebruikers-JWT rechtstreeks de Supabase REST API aanroept, moet hij nog
   steeds niets van een andere organisatie kunnen zien.
2. **Autorisatie leidt af uit expliciete relaties, nooit uit afwezigheid van
   een check.** Een chauffeur ziet een cliënt omdat er een rit bestaat die aan
   hem is toegewezen — niet omdat we vergeten zijn te filteren.
3. **Businessregels wonen in de service-laag, niet in React-componenten.**
   Statusovergangen, ritgeneratie en check-in gaan door één service met tests.
4. **Geen `any`.** Databasetypes worden gegenereerd uit het Supabase-schema.
5. **Data-minimalisatie is een ontwerpregel, geen nabeschouwing.** Zie
   `SECURITY.md` §GDPR. Dit is een vervoersplatform, geen zorgdossier.
6. **Elke databasewijziging is een migration in Git.** Geen handmatige
   wijzigingen in het Supabase-dashboard.
7. **Bouw voor 100+ organisaties, optimaliseer niet prematuur.** Concreet:
   indexes, server-side paginatie en filtering vanaf dag één; caching en
   read-replicas pas als meetdata daarom vraagt.

## 3. Technologiekeuzes

| Laag | Keuze | Waarom |
|---|---|---|
| Framework | Next.js 15, App Router | Server Components houden PII server-side; Server Actions geven getypeerde mutaties zonder losse API-laag |
| UI | React 19, TypeScript strict | Voorgeschreven |
| Styling | Tailwind CSS v4 + CSS custom properties | White-label kleuren moeten runtime per tenant wisselen — dat kan met CSS-variabelen, niet met build-time Tailwind-config |
| Componenten | Eigen design system, opgezet in de stijl van shadcn/ui (gekopieerde, aanpasbare primitives op Radix) | Radix levert de toegankelijkheid (focus trap, ARIA, keyboard) die §48 vereist; we houden de code in de repo zodat white-label styling geen fork nodig heeft |
| Database | PostgreSQL 15+ via Supabase | Voorgeschreven |
| Auth | Supabase Auth (`@supabase/ssr`) | Voorgeschreven; cookie-based sessies werken met Server Components |
| Realtime | Supabase Realtime | Voorgeschreven — met beperkingen, zie §9 |
| Hosting | Vercel | Voorgeschreven; wildcard-domeinen voor white-label |
| Tests | Vitest (unit + integratie), pgTAP (`supabase test db`) voor RLS | pgTAP test policies in de database; Vitest test het écht gebruikte pad (PostgREST met een echt gebruikers-JWT) |
| E2E | Playwright | Al aanwezig in de omgeving; nodig voor de chauffeursflow |

**Nieuwe dependencies** worden per stuk verantwoord in de PR-omschrijving (§67.14).
De lijst hierboven is de volledige toegestane basis voor Fase 1–6.

## 4. Applicatiestructuur

```
tagpoint-taxi-dispatch/
├── docs/                          # ARCHITECTURE, DATABASE, SECURITY, ...
├── supabase/
│   ├── migrations/                # genummerde SQL-migrations (bron van waarheid)
│   ├── seed/                      # dev seed data (fictief)
│   ├── tests/                     # pgTAP RLS- en constraint-tests
│   └── config.toml
├── src/
│   ├── app/
│   │   ├── (public)/              # login, wachtwoord reset, marketing
│   │   ├── (org)/                 # beheer/planning — desktop-first
│   │   │   ├── dashboard/
│   │   │   ├── planning/
│   │   │   ├── dispatch/
│   │   │   ├── rides/[rideId]/
│   │   │   ├── clients/[clientId]/
│   │   │   ├── drivers/ vehicles/ locations/
│   │   │   ├── care-organizations/
│   │   │   ├── tags/              # NFC + QR (één systeem, zie NFC.md)
│   │   │   ├── reports/ users/ settings/
│   │   ├── driver/                # chauffeurs-PWA — mobile-first
│   │   │   ├── today/
│   │   │   ├── rides/[rideId]/
│   │   │   └── scan/
│   │   ├── portal/
│   │   │   ├── client/
│   │   │   ├── contact/           # ouder/contactpersoon
│   │   │   └── care/              # opdrachtgever/zorginstelling
│   │   ├── platform/              # platformbeheer (§57)
│   │   ├── t/[token]/             # NFC/QR landing — geen PII (zie NFC.md)
│   │   └── api/                   # alleen waar een route handler echt nodig is
│   ├── features/                  # domeinmodules — het hart van de codebase
│   │   ├── organizations/
│   │   ├── auth/
│   │   ├── rbac/
│   │   ├── clients/
│   │   ├── contacts/
│   │   ├── care-organizations/
│   │   ├── drivers/ vehicles/ locations/
│   │   ├── rides/                 # incl. state machine
│   │   ├── ride-templates/        # terugkerende ritten + generatie
│   │   ├── planning/ dispatch/
│   │   ├── tags/                  # NFC/QR
│   │   ├── portals/
│   │   ├── branding/
│   │   ├── reports/
│   │   └── audit/
│   ├── components/ui/             # design system primitives
│   ├── components/layout/         # shells, sidebar, header
│   ├── lib/
│   │   ├── supabase/              # server/browser/admin clients
│   │   ├── errors/                # AppError-hiërarchie
│   │   ├── result/                # Result<T, E>
│   │   ├── tenant/                # host → organisatie resolutie
│   │   └── datetime/              # tijdzone-helpers (zie §8)
│   ├── types/
│   │   ├── database.ts            # GEGENEREERD — niet handmatig bewerken
│   │   └── ...
│   └── middleware.ts
└── tests/
    ├── security/                  # tenant-isolatie (§54) — verplicht groen
    └── e2e/
```

**Interne structuur van een feature-module** (consistent voor alle features):

```
features/rides/
├── schema.ts        # Zod-schemas — de enige plek waar input wordt gevalideerd
├── repository.ts    # dataverkeer; kent SQL/PostgREST, kent geen businessregels
├── service.ts       # businessregels + permissiechecks; kent geen React en geen HTTP
├── actions.ts       # Server Actions — dunne laag: auth → validatie → service
├── state-machine.ts # (rides) toegestane statusovergangen
├── components/      # React-componenten voor dit domein
├── hooks/
└── __tests__/
```

Regel: **`actions.ts` bevat geen businesslogica** en **`components/` roept nooit
`repository.ts` aan**. Zo blijft §44 ("business rules mogen niet verspreid staan
over tientallen React components") afdwingbaar in code review.

## 5. Request-lifecycle en waar autorisatie gebeurt

```
Browser
  │
  ├─ middleware.ts
  │    • ververst de Supabase-sessie (cookies)
  │    • resolvet host → organisatie (white-label/custom domain)
  │    • redirect naar /login als er geen sessie is
  │    ⚠ middleware is UX-routing, GEEN autorisatie (§58)
  │
  ├─ Server Component / Server Action
  │    • createServerClient() → gebruikers-JWT, RLS actief
  │    • service-laag: requirePermission(orgId, 'rides.update')
  │    • repository → PostgREST
  │
  └─ PostgreSQL
       • RLS-policies — de daadwerkelijke beveiligingsgrens
```

Er zijn dus **drie** lagen, en alleen de onderste is vertrouwd:

| Laag | Doel | Vertrouwd? |
|---|---|---|
| Middleware | Routing en redirects | Nee |
| Service-laag | Duidelijke foutmeldingen, businessregels, auditlog | Nee (defense in depth) |
| RLS | Tenant-isolatie en scoping | **Ja** |

Als de service-laag een permissiecheck vergeet, mag dat hooguit een lelijke
lege lijst opleveren — nooit datalek naar een andere organisatie.

## 6. Multi-tenancy model

**Gekozen: gedeeld schema, gedeelde tabellen, `organization_id` per rij, RLS.**

Alternatieven die zijn afgewogen:

| Model | Isolatie | Kosten bij 500 tenants | Migraties | Oordeel |
|---|---|---|---|---|
| Database per tenant | Sterkst | Onbetaalbaar op Supabase | 500× uitvoeren | Afgevallen |
| Schema per tenant | Sterk | Duizenden tabellen, trage `pg_dump`, connection-pool druk | 500× uitvoeren, foutgevoelig | Afgevallen |
| **Gedeeld + RLS** | Sterk mits correct | Lineair, één schema | Eén keer | **Gekozen** |

De prijs van deze keuze is dat isolatie afhangt van correct geschreven policies.
Daarom is §54 (tenant-isolatietests) geen optionele extra maar een
merge-blokkerende testsuite.

### Hoe de database weet wie je bent

Alle helpers staan in een apart `app`-schema, zijn `SECURITY DEFINER`, `STABLE`,
en draaien met `SET search_path = ''`:

| Functie | Levert |
|---|---|
| `app.member_org_ids()` | `uuid[]` van organisaties waar de gebruiker actief lid is |
| `app.has_permission(org, perm)` | `boolean` — permissie via toegewezen rollen |
| `app.is_platform_admin()` | `boolean` — uit `platform_admins`, niet uit een JWT-claim |
| `app.driver_ride_ids()` | ritten toegewezen aan de ingelogde chauffeur |
| `app.visible_client_ids()` | cliënten zichtbaar voor de huidige principal |

**Bewust géén organisatie-claim in het JWT.** Een JWT-claim is snel, maar blijft
tot een uur geldig nadat iemand uit een organisatie is verwijderd. Voor een
platform met persoonsgegevens van kwetsbare cliënten weegt correcte intrekking
zwaarder dan een paar milliseconden. Zie `RISKS_AND_DECISIONS.md` D-04.

**Performance:** policies roepen deze functies aan als `(select app.fn())`.
Postgres maakt daar een InitPlan van die één keer per statement wordt
uitgevoerd in plaats van één keer per rij. Zonder deze haakjes wordt een query
over 10.000 ritten 10.000 functieaanroepen. Dit is een verplichte conventie in
elke policy, met een testcase die het afdwingt.

## 7. RBAC

Volledig databasegedreven, geen `if (user.role === 'admin')` in de codebase.

```
profiles ──< organization_users ──< organization_user_roles >── roles ──< role_permissions >── permissions
```

Een gebruiker kan lid zijn van meerdere organisaties met verschillende rollen
(§7). `roles.organization_id IS NULL` markeert een systeemrol-sjabloon; een
organisatie kan later eigen rollen maken zonder schemawijziging. Zie
`ROLES_AND_PERMISSIONS.md` voor de volledige catalogus.

## 8. Tijd en tijdzones

**Dit is een correctheidsvraagstuk, geen detail.** Een terugkerende rit is
gedefinieerd in *lokale wandkloktijd*: "elke werkdag om 08:00". Als je dat als
UTC-timestamp opslaat, vertrekt de bus na de zomertijdovergang om 09:00.

Daarom:

- `ride_templates.departure_time` is een `time` in de tijdzone van de organisatie.
- `rides` slaat zowel `scheduled_date` + `scheduled_pickup_time` (lokaal,
  gezaghebbend) als `scheduled_pickup_at timestamptz` (afgeleid, voor sorteren
  en filteren) op.
- `organization_settings.timezone` (default `Europe/Amsterdam`) is de bron voor
  die conversie.
- Alle event-timestamps (`ride_events.occurred_at`) zijn `timestamptz` — een
  gebeurtenis vindt plaats op een absoluut moment.

## 9. Realtime

Supabase Realtime wordt **beperkt** ingezet (§30: "voorkom onnodige realtime
subscriptions"):

| Scherm | Realtime? |
|---|---|
| Dispatch (live ritten van vandaag) | Ja |
| Dashboard-tellers vandaag | Ja, gedebounced |
| Cliënten-, chauffeurs-, voertuigenlijsten | Nee |
| Portalen (cliënt/ouder/opdrachtgever) | Nee — polling bij focus |

**Schaalwaarschuwing:** `postgres_changes` respecteert RLS, maar Supabase
evalueert de policies per abonnee per wijziging. Bij honderden organisaties met
elk meerdere dispatchers wordt dat het eerste knelpunt. De architectuur wordt
daarom nu al zo neergezet dat de dispatch-client achter één
`useRideStream(organizationId)`-hook zit. Overstappen op Realtime Broadcast met
een kanaal per organisatie (`org:<id>:rides`, gevoed door een database-trigger)
is dan een wijziging in één bestand. We bouwen broadcast nog niet — we maken de
overstap goedkoop.

## 10. Ritgeneratie uit terugkerende templates

Rides worden **gematerialiseerd** (echte rijen), niet virtueel berekend. Reden:
een rit moet een chauffeur, een voertuig, een status, events en uitzonderingen
kunnen dragen — dat kan niet op een virtuele rij.

- Een idempotente job genereert ritten voor een **rollend venster** van
  standaard 60 dagen vooruit (`organization_settings.ride_generation_horizon_days`).
- Dubbele ritten worden op databaseniveau voorkomen met een partiële unique
  index op `(ride_template_id, scheduled_date)`. Applicatielogica alleen is niet
  genoeg — twee gelijktijdige jobs zouden dan allebei slagen.
- Generatie is **additief**. Een rit die handmatig is gewijzigd
  (`is_modified = true`) of die `SCHEDULED` verlaten heeft, wordt nooit
  overschreven. Zo blijft de uitzondering uit §15 intact.
- Een uitzondering is een bewerking op de gegenereerde **rit**, niet op de
  template. De template blijft dus schoon (letterlijk de eis uit §15).
- Trigger: Vercel Cron dagelijks, plus expliciete generatie bij het aanmaken of
  activeren van een template zodat de planner direct resultaat ziet.

## 11. White-label en custom domains

```
Request host
  ├─ app.tagpoint.nl / localhost / *.vercel.app  → platform-host, org uit sessie
  └─ dispatch.taxi-ontzorgd.nl                   → organization_domains lookup
```

De host bepaalt **branding en de standaard organisatiecontext** — nooit
autorisatie. Een gebruiker die `dispatch.taxi-ontzorgd.nl` bezoekt zonder
lidmaatschap krijgt niets te zien, ongeacht de host. De `Host`-header is door de
client te vervalsen en wordt daarom nooit in een RLS-policy gebruikt.

Branding wordt als CSS custom properties (`--tp-primary`, `--tp-secondary`) op
de root gezet in de server-rendered layout, zodat er geen flits van
platformkleuren is.

## 12. Foutafhandeling

- Eén `AppError`-hiërarchie: `ValidationError`, `AuthenticationError`,
  `AuthorizationError`, `NotFoundError`, `ConflictError`, `StateTransitionError`.
- Services geven `Result<T, AppError>` terug in plaats van te throwen op
  verwachte fouten; onverwachte fouten throwen wel.
- Elke fout heeft een stabiele `code` voor vertaling in de UI en een
  `correlationId` voor logging.
- **Logs bevatten geen persoonsgegevens** (§45, §38). We loggen `client_id`,
  nooit een cliëntnaam of adres.
- `AuthorizationError` en `NotFoundError` geven naar buiten dezelfde melding bij
  cross-tenant toegang, zodat een aanvaller niet kan afleiden dát een record
  bestaat.

## 13. Wat we bewust NIET bouwen

Facturatie, betalingen, WhatsApp, live GPS-tracking, routeoptimalisatie,
automatische dispatch, kilometerregistratie, urenregistratie (§64).

De architectuur blokkeert deze uitbreidingen niet: `plans`/`subscriptions`/
`usage_metrics` staan als leeg skelet in het schema, `notifications` heeft een
kanaal-veld, en de state machine is data, geen `switch`.
