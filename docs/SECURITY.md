# TagPoint Taxi Dispatch — Security

> Status: **ontwerp (Fase 0/1)**.
> Dit document beschrijft het beveiligingsmodel. Afwijken mag alleen door dit
> document eerst te wijzigen.

---

## 1. Wat we beschermen

Het platform bevat persoonsgegevens van mensen die vaak kwetsbaar zijn:
kinderen, ouderen, mensen met een beperking. Per cliënt weten we naam, adres,
telefoonnummer, en — via het ritpatroon — **waar iemand elke dag is en wanneer
hij niet thuis is**. Dat laatste is minstens zo gevoelig als de adresgegevens
zelf en wordt in beveiligingsafwegingen als zodanig behandeld.

Beschermwaardig, in volgorde van ernst bij verlies:

1. Cliëntgegevens en ritpatronen van een organisatie
2. Toegangsbeheer (wie mag namens wie handelen)
3. Integriteit van de audit trail (`ride_events`, `audit_logs`)
4. Beschikbaarheid van de dagplanning

## 2. Dreigingsmodel

| # | Dreiging | Beheersmaatregel |
|---|---|---|
| T1 | Organisatie A leest/wijzigt data van organisatie B | RLS op elke tenant-tabel; verplichte isolatietests (§8) |
| T2 | Ingelogde gebruiker roept de Supabase REST API rechtstreeks aan en omzeilt de UI | RLS is de grens, niet de frontend; anon key is publiek en dat is by design |
| T3 | Chauffeur bekijkt cliënten waar hij geen rit voor heeft | RLS-policy op `clients` scopet op toegewezen ritten binnen een datumvenster |
| T4 | Ouder bekijkt een ander kind | RLS via `client_contacts`; rechten staan op de koppeling |
| T5 | Opdrachtgever ziet cliënten die hij niet financiert | RLS via `client_care_organizations` inclusief geldigheidsperiode |
| T6 | Privilege-escalatie: lid kent zichzelf een hogere rol toe | `organization.members.manage`-recht + trigger die rolwissel naar een rol met meer rechten dan de actor blokkeert |
| T7 | Rolinjectie over tenants heen | Trigger: een toegewezen rol moet systeemrol zijn of tot dezelfde organisatie behoren |
| T8 | NFC/QR-URL lekt persoonsgegevens aan een vinder | Publieke landingspagina toont **nooit** PII; identificatie gebeurt pas na authenticatie |
| T9 | Tag-enumeratie (`/t/TP-TAXI-000001` … `000002`) | 128-bit random token in de URL, gehasht opgeslagen; het leesbare `public_code` staat niet in de URL |
| T10 | Manipulatie van de audit trail | `ride_events`/`audit_logs` append-only op drie lagen (RLS, grants, trigger) |
| T11 | Service role key lekt naar de client | Key alleen in `lib/supabase/admin.ts` met `import 'server-only'`; CI-check op de bundle |
| T12 | IDOR via geraden id's | uuid v4 pk's + RLS; niet-geautoriseerd en niet-bestaand geven dezelfde melding |
| T13 | Platformbeheerder-account gecompromitteerd = alle tenants gelekt | Platformbeheerders krijgen géén standaard toegang tot tenant-PII (§5) |
| T14 | Host-header spoofing om een andere tenantcontext te krijgen | De host bepaalt alleen branding; autorisatie gaat via lidmaatschap |
| T15 | Bruteforce op login / massale tag-scans | Rate limiting op auth-endpoints en op de check-in route |
| T16 | XSS via white-label branding | Kleuren gevalideerd met regex, logo's alleen via geverifieerde upload, geen vrije CSS/HTML |

## 3. Authenticatie

- Supabase Auth met e-mail/wachtwoord, e-mailverificatie, wachtwoordreset.
- Sessies in httpOnly-cookies via `@supabase/ssr` — geen tokens in
  `localStorage` (dan is XSS meteen accountovername).
- Alle portalen (beheer, chauffeur, cliënt, ouder, opdrachtgever) delen één
  `auth.users`-pool. **Een account heeft uit zichzelf nul rechten.** Toegang
  ontstaat alleen door een expliciete rij in `organization_users`,
  `client_contacts`, `care_organization_users` of `drivers.user_id`. Er is geen
  standaardrol en geen impliciete toegang.
- Magic link is voorbereid maar staat uit in V1.

## 4. Autorisatie in drie lagen

```
middleware      → routing/redirects        (NIET vertrouwd)
service-laag    → requirePermission()      (defense in depth)
RLS             → policies                 (DE beveiligingsgrens)
```

De service-laag bestaat voor duidelijke foutmeldingen, auditlogging en
businessregels. Als hij faalt, is het gevolg hooguit een lege lijst of een
verwarrende melding — nooit een datalek.

### RLS-patronen

Elke tenant-tabel krijgt minimaal:

```sql
alter table clients enable row level security;

create policy clients_select on clients for select to authenticated
using (
  organization_id = any ((select app.member_org_ids()))
  and (select app.has_permission(organization_id, 'clients.view'))
);

create policy clients_insert on clients for insert to authenticated
with check (
  organization_id = any ((select app.member_org_ids()))
  and (select app.has_permission(organization_id, 'clients.create'))
);
```

Drie regels die in review worden afgedwongen:

1. **`(select ...)` om elke helperaanroep.** Postgres maakt er dan een InitPlan
   van die één keer per statement draait in plaats van één keer per rij. Zonder
   de haakjes is een lijst van 10.000 ritten 10.000 functieaanroepen.
2. **`with check` op elke INSERT en UPDATE.** Een `using`-clausule alleen laat
   toe dat je een rij *naar* een andere organisatie schrijft.
3. **Aparte policies per commando.** `for all` verbergt te makkelijk een gat.

Helperfuncties staan in schema `app`, zijn `security definer`, `stable`, en
draaien met `set search_path = ''` (anders is search-path-hijacking mogelijk).
`execute` op deze functies is alleen aan `authenticated` verleend.

### Scoping per principal

| Principal | Ziet cliënten | Ziet ritten |
|---|---|---|
| Org-medewerker met `clients.view` | Alle binnen de organisatie | Volgens permissies |
| Chauffeur | Alleen cliënten met een aan hem toegewezen rit binnen het venster (gisteren t/m +7 dagen) | Eigen toegewezen ritten |
| Cliënt | Alleen zichzelf | Eigen ritten |
| Contactpersoon | Alleen gekoppelde cliënten met `can_view_rides` | Ritten van die cliënten |
| Opdrachtgever | Cliënten met een geldige koppeling | Ritten van die cliënten |

Het datumvenster voor chauffeurs is bewust: een chauffeur die vorig jaar één rit
reed hoort niet permanent het adres van die cliënt te kunnen opvragen.

## 5. Platformbeheer — geen achterdeur

**Dit is een expliciete keuze en wijkt af van hoe veel SaaS-platforms dit doen.**

Platformbeheerders (§57) krijgen via RLS toegang tot:

- `organizations`, `organization_settings`, `organization_domains`
- `subscriptions`, `usage_metrics`
- geaggregeerde aantallen (aantal gebruikers, chauffeurs, ritten)
- systeemlogs zonder persoonsgegevens

Zij krijgen via RLS **géén** toegang tot `clients`, `contacts`, `rides`,
`ride_events` of `nfc_tags`. Reden: één gecompromitteerd platformaccount zou
anders de persoonsgegevens van alle klanten tegelijk blootleggen — precies het
scenario dat een verwerkersovereenkomst moet uitsluiten.

Support-toegang tot echte tenantdata loopt via `support_access_grants`:
tijdgebonden, met reden, door de organisatie zelf verleend, automatisch
verlopend en volledig geaudit. Zolang dat mechanisme er niet is (het staat
gepland voor Fase 12), is er simpelweg geen supporttoegang tot cliëntgegevens.
Zie `RISKS_AND_DECISIONS.md` D-02.

## 6. NFC/QR-beveiliging

Zie `NFC.md` voor het volledige ontwerp. De kern:

- De URL is `/t/<token>` met een 128-bit random token, base32-gecodeerd.
- De database slaat alleen `sha256(token)` op. Een databasedump levert dus geen
  werkende tag-URL's op.
- De publieke landingspagina toont **niets** persoonlijks: geen naam, geen
  adres, geen "deze tag hoort bij een cliënt van Taxi Ontzorgd". Een
  niet-ingelogde bezoeker ziet een neutrale pagina met een loginknop.
- Identificatie gebeurt pas ná authenticatie én autorisatie: alleen een
  chauffeur met een rit voor die cliënt, vandaag, ziet de naam.
- Scannen is nooit op zichzelf een autorisatie. Het token identificeert een tag;
  het JWT identificeert de handelende persoon.
- Rate limiting per IP en per account op de check-in route.

## 7. Secrets en configuratie

| Variabele | Zichtbaarheid | Opmerking |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Publiek | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publiek | Veilig omdat RLS aanstaat — dat is de hele aanname |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | Alleen in `lib/supabase/admin.ts` |
| `CRON_SECRET` | Server-only | Beveiligt de ritgeneratie-endpoint |
| `TAG_TOKEN_PEPPER` | Server-only | Extra pepper bij het hashen van tag-tokens |

Regels:

- `.env.local` staat in `.gitignore`; `.env.example` bevat alleen placeholders.
- `lib/supabase/admin.ts` begint met `import 'server-only'` zodat een
  onbedoelde client-import een **buildfout** wordt, geen productielek.
- De service-role client wordt alleen gebruikt voor: gebruikersuitnodigingen,
  de ritgeneratiejob en het GDPR-erasurepad. Elke aanroep filtert expliciet op
  `organization_id`; er komt een wrapper die dat argument verplicht maakt, zodat
  "vergeten te filteren" niet compileert.
- Secrets worden nooit gelogd. Bij een 500 gaat er een `correlationId` naar de
  gebruiker, de details naar de serverlog.

## 8. Verplichte beveiligingstests (§53, §54)

Deze suite blokkeert de merge. Elke test draait tegen een echte lokale Supabase
met **echte gebruikers-JWT's per persona** — niet met de service role, want dan
test je RLS niet.

| # | Scenario | Verwacht |
|---|---|---|
| S1 | Org A leest rit van Org B | 0 rijen |
| S2 | Org A update cliënt van Org B | 0 rijen geraakt |
| S3 | Org A insert rit met `organization_id` van B | geweigerd door `with check` |
| S4 | Org A delete cliënt van Org B | 0 rijen geraakt |
| S5 | Chauffeur leest cliënt zonder toegewezen rit | 0 rijen |
| S6 | Chauffeur leest rit van een collega | 0 rijen |
| S7 | Chauffeur wijzigt rit-status buiten de state machine | geweigerd |
| S8 | Ouder A leest cliënt B | 0 rijen |
| S9 | Ouder wijzigt rechtstreeks een rit | geweigerd; alleen `change_requests` |
| S10 | Opdrachtgever leest cliënt buiten geldige koppeling | 0 rijen |
| S11 | Cliëntportaal leest andere cliënt | 0 rijen |
| S12 | Lid zonder `clients.create` maakt cliënt | geweigerd |
| S13 | Lid kent zichzelf de owner-rol toe | geweigerd |
| S14 | Rol van Org B toewijzen binnen Org A | geweigerd |
| S15 | Update van `ride_events` | geweigerd (3 lagen) |
| S16 | Delete van `audit_logs` | geweigerd |
| S17 | Platformbeheerder leest `clients` | 0 rijen (bewust) |
| S18 | Anonieme gebruiker leest willekeurige tabel | 0 rijen |
| S19 | Tweede NFC-scan op dezelfde rit | geen tweede event; nette melding |
| S20 | Tag-token van Org B gebruiken binnen Org A | geweigerd |
| S21 | Verwijderd/gesuspendeerd lid bevraagt de organisatie | direct 0 rijen, geen JWT-vertraging |

Aanvullend: een CI-check die faalt op elke tabel in `public` **zonder**
`rowsecurity = true`. Nieuwe tabellen kunnen dan niet ongemerkt onbeveiligd
blijven.

## 9. GDPR en privacy

**Grondslag en rollen.** De vervoersorganisatie is verwerkingsverantwoordelijke,
TagPoint is verwerker. Het platform moet daarom per organisatie kunnen
exporteren, wissen en aantonen wie wat wanneer zag.

**Data-minimalisatie — wat we bewust NIET opslaan:**
- geen BSN
- geen geboortedatum (niet nodig om iemand te vervoeren)
- geen medische diagnoses, medicatie of zorgindicaties
- geen permanente locatietracking van chauffeurs
- geen foto's van cliënten

**GPS (§26):** alleen een momentopname bij een handeling
(`DRIVER_ARRIVED`, `CLIENT_CHECKED_IN`, `TRIP_STARTED`, `ARRIVED`, `COMPLETED`),
alleen als de organisatie het aanzet én de gebruiker toestemming geeft, met een
zichtbare indicator in de PWA. Geen achtergrondtracking.

**Bewaartermijnen (voorbereiding, Fase 12):** `retention_policies` per
organisatie; ritten en events worden na de termijn geanonimiseerd, niet
verwijderd (zie `DATABASE.md` §10).

**Rechten van betrokkenen:** export en erasure als serviceoperaties met
auditlog, uitvoerbaar door de organisatie zelf.

**Logging:** geen namen, adressen of e-mailadressen in applicatielogs. We loggen
id's. Dit is een reviewregel, geen aanbeveling.

**Openstaand punt:** `clients.transport_requirements` en `transport_notes`
kunnen als gezondheidsgegevens (AVG art. 9) worden aangemerkt. Zie
`RISKS_AND_DECISIONS.md` D-03 — dit vraagt een besluit vóór Fase 2.

## 10. Webbeveiliging

- **Security headers** via `next.config.ts`: HSTS, `X-Content-Type-Options`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
  Permissions-Policy die alleen `geolocation` op de chauffeursroutes toestaat,
  en een CSP zonder `unsafe-inline` voor scripts.
- **CSRF:** Server Actions van Next.js controleren de Origin-header; state-
  wijzigende route handlers doen dat expliciet.
- **XSS:** geen `dangerouslySetInnerHTML`; brandingkleuren via
  regex-gevalideerde CSS-variabelen.
- **SQL-injectie:** alleen geparametriseerde queries via PostgREST/RPC; geen
  stringconcatenatie in SQL, ook niet in migrations met dynamische SQL.
- **Uploads:** logo's naar Supabase Storage met MIME- en groottevalidatie
  server-side, hernoemd naar een uuid, geen SVG (SVG kan script bevatten).
- **Rate limiting:** login, wachtwoordreset, tag check-in en portaalacties.

## 11. Auditlogging

Geaudit worden minimaal: aanmaken/wijzigen/verwijderen van gebruikers, rollen en
permissies; wijzigingen aan cliënten en contacten; aanmaken, wijzigen en
annuleren van ritten; chauffeurtoewijzing; tag koppelen/ontkoppelen/vervangen;
elke `force_status`; wijzigingen aan organisatie-instellingen, branding en
domeinen; verlenen en gebruiken van support-toegang; export en erasure.

Auditlogs zijn append-only en voor normale gebruikers niet verwijderbaar (§37).
Ze bevatten veldnamen, geen oude en nieuwe persoonsgegevens.
