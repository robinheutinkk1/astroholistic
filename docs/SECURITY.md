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

| #   | Dreiging                                                                         | Beheersmaatregel                                                                                                 |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| T1  | Organisatie A leest/wijzigt data van organisatie B                               | RLS op elke tenant-tabel; verplichte isolatietests (§8)                                                          |
| T2  | Ingelogde gebruiker roept de Supabase REST API rechtstreeks aan en omzeilt de UI | RLS is de grens, niet de frontend; anon key is publiek en dat is by design                                       |
| T3  | Chauffeur bekijkt cliënten waar hij geen rit voor heeft                          | RLS-policy op `clients` scopet op toegewezen ritten binnen een datumvenster                                      |
| T4  | Ouder bekijkt een ander kind                                                     | RLS via `client_contacts`; rechten staan op de koppeling                                                         |
| T5  | Opdrachtgever ziet cliënten die hij niet financiert                              | RLS via `client_care_organizations` inclusief geldigheidsperiode                                                 |
| T6  | Privilege-escalatie: lid kent zichzelf een hogere rol toe                        | `organization.members.manage`-recht + trigger die rolwissel naar een rol met meer rechten dan de actor blokkeert |
| T7  | Rolinjectie over tenants heen                                                    | Trigger: een toegewezen rol moet systeemrol zijn of tot dezelfde organisatie behoren                             |
| T8  | NFC/QR-URL lekt persoonsgegevens aan een vinder                                  | Publieke landingspagina toont **nooit** PII; identificatie gebeurt pas na authenticatie                          |
| T9  | Tag-enumeratie (`/t/TP-TAXI-000001` … `000002`)                                  | 128-bit random token in de URL, gehasht opgeslagen; het leesbare `public_code` staat niet in de URL              |
| T10 | Manipulatie van de audit trail                                                   | `ride_events`/`audit_logs` append-only op drie lagen (RLS, grants, trigger)                                      |
| T11 | Service role key lekt naar de client                                             | Key alleen in `lib/supabase/admin.ts` met `import 'server-only'`; CI-check op de bundle                          |
| T12 | IDOR via geraden id's                                                            | uuid v4 pk's + RLS; niet-geautoriseerd en niet-bestaand geven dezelfde melding                                   |
| T13 | Platformbeheerder-account gecompromitteerd = alle tenants gelekt                 | Platformbeheerders krijgen géén standaard toegang tot tenant-PII (§5)                                            |
| T14 | Host-header spoofing om een andere tenantcontext te krijgen                      | De host bepaalt alleen branding, en alleen via `branding_for_host` dat uitsluitend **geverifieerde** domeinen matcht; autorisatie gaat via lidmaatschap en RLS |
| T15 | Bruteforce op login / massale tag-scans                                          | Rate limiting op auth-endpoints en op de check-in route                                                          |
| T16 | XSS via white-label branding                                                     | Kleuren gevalideerd met regex in formulier, service én CHECK-constraint; logo's alleen via magic-byte-validatie, SVG volledig geweigerd; geen vrije CSS/HTML |
| T17 | Tenant zet `logo_path`/`logo_url` naar een externe URL of een pad buiten de eigen map (tracking pixel op portaalpagina's die ouders zien) | Kolom bevat een pad, geen URL; CHECK-constraint pint het exact op `<organization_id>/logo.<ext>`; de URL wordt in code samengesteld |
| T18 | Organisatie claimt de domeinnaam van een concurrent en gebruikt of blokkeert die | Uniciteit geldt pas bij `VERIFIED`; verificatie via DNS TXT wordt server-side gedaan en met de service role weggeschreven; een trigger blokkeert de tenant zelf |
| T19 | Rapportage lekt over de tenantgrens omdat een aggregaat de RLS omzeilt | Alle rapportagefuncties zijn `security invoker` + expliciete `reports.view`-check; de catalogus wordt in de suite gecontroleerd (S32) |
| T20 | CSV-export voert code uit op de pc van de planner (formule-injectie) | Cellen die met `=`, `+`, `-`, `@`, tab of CR beginnen krijgen een apostrof; getallen blijven getallen |
| T21 | Export haalt persoonsgegevens uit het systeem zonder spoor | Elke export schrijft `report.exported` in de append-only audit trail, met periode en aantal rijen |
| T22 | Chauffeur downloadt een volledig dossier via het exportpunt | `export_client_data()` eist expliciet `clients.view`; RLS alleen was **niet** genoeg (S47) |
| T23 | Support-toegang wordt permanent of ongemerkt verleend | Grant is tijdgebonden, alleen-lezen, door de tenant zelf verleend en ingetrokken, en staat in de audit trail (S39–S45) |
| T24 | Erasure vernietigt de vervoersadministratie | Anonimiseren in plaats van verwijderen; ritten en events blijven (S49) |
| T25 | Nieuwe tabel mist RLS of grants en lekt of blokkeert stil | Coveragetest op `pg_tables`; de grant van 0010 is een momentopname en elke latere tabel krijgt een eigen grant |
| T26 | Bruteforce op login of wachtwoordreset | `consume_rate_limit()` in de database, per adres én per account; alleen de service role mag hem aanroepen |
| T27 | Iemand die leden mag beheren deelt via een uitnodiging rollen uit die hij zelf niet mag geven | `inviteMember()` eist óók `organization.roles.manage`, en de policy op `organization_user_roles` is de laatste grens (S58, S61) |
| T28 | Een uitgenodigd adres krijgt post terwijl de uitnodiging wordt geweigerd | Rechten en rolkeuze worden gecontroleerd vóór er een account wordt gemaakt; hetzelfde geldt voor portaaltoegang (S65) |
| T29 | Uitnodigingen worden gebruikt om massaal onbekenden aan te schrijven | Emmer `member-invite`, 25 per uur, per organisatie en niet per uitnodiger |
| T30 | Portaaltoegang koppelt een vreemd account aan een cliëntdossier | Alleen binnen de eigen organisatie (`clients.update` / `contacts.manage` / `care_organizations.manage`); een portaalgebruiker kan zichzelf nergens aan koppelen (S66–S71) |
| T31 | De planner kan niet zien wélk adres toegang heeft tot een dossier | `app.linked_portal_user_ids()` opent `profiles` precies zo ver als nodig: alleen accounts die aan een eigen cliënt, contactpersoon of zorgorganisatie hangen (S72–S75) |
| T32 | Een koppeling steekt de tenantgrens over: een contactpersoon of opdrachtgever van vervoerder B wordt aan een cliënt van A gehangen, waarmee diens portaalgebruiker inzage krijgt | Migratie 0029: de policies op `client_contacts` en `client_care_organizations` eisen dat **beide** kanten in dezelfde organisatie zitten, op insert én update (S78–S80) |
| T33 | Een afgelopen indicatie blijft toegang geven | `valid_from`/`valid_to` worden door RLS gelezen, niet door het scherm (S86–S87) |

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
   toe dat je een rij _naar_ een andere organisatie schrijft.
3. **Aparte policies per commando.** `for all` verbergt te makkelijk een gat.

Helperfuncties staan in schema `app`, zijn `security definer`, `stable`, en
draaien met `set search_path = ''` (anders is search-path-hijacking mogelijk).
`execute` op deze functies is alleen aan `authenticated` verleend.

### Scoping per principal

| Principal                         | Ziet cliënten                                                                             | Ziet ritten             |
| --------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------- |
| Org-medewerker met `clients.view` | Alle binnen de organisatie                                                                | Volgens permissies      |
| Chauffeur                         | Alleen cliënten met een aan hem toegewezen rit binnen het venster (gisteren t/m +7 dagen) | Eigen toegewezen ritten |
| Cliënt                            | Alleen zichzelf                                                                           | Eigen ritten            |
| Contactpersoon                    | Alleen gekoppelde cliënten met `can_view_rides`                                           | Ritten van die cliënten |
| Opdrachtgever                     | Cliënten met een geldige koppeling                                                        | Ritten van die cliënten |

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

| Variabele                       | Zichtbaarheid   | Opmerking                                          |
| ------------------------------- | --------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Publiek         |                                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publiek         | Veilig omdat RLS aanstaat — dat is de hele aanname |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Server-only** | Alleen in `lib/supabase/admin.ts`                  |
| `CRON_SECRET`                   | Server-only     | Beveiligt de ritgeneratie-endpoint                 |
| `TAG_TOKEN_PEPPER`              | Server-only     | Extra pepper bij het hashen van tag-tokens         |

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

| #   | Scenario                                             | Verwacht                            |
| --- | ---------------------------------------------------- | ----------------------------------- |
| S1  | Org A leest rit van Org B                            | 0 rijen                             |
| S2  | Org A update cliënt van Org B                        | 0 rijen geraakt                     |
| S3  | Org A insert rit met `organization_id` van B         | geweigerd door `with check`         |
| S4  | Org A delete cliënt van Org B                        | 0 rijen geraakt                     |
| S5  | Chauffeur leest cliënt zonder toegewezen rit         | 0 rijen                             |
| S6  | Chauffeur leest rit van een collega                  | 0 rijen                             |
| S7  | Chauffeur wijzigt rit-status buiten de state machine | geweigerd                           |
| S8  | Ouder A leest cliënt B                               | 0 rijen                             |
| S9  | Ouder wijzigt rechtstreeks een rit                   | geweigerd; alleen `change_requests` |
| S10 | Opdrachtgever leest cliënt buiten geldige koppeling  | 0 rijen                             |
| S11 | Cliëntportaal leest andere cliënt                    | 0 rijen                             |
| S12 | Lid zonder `clients.create` maakt cliënt             | geweigerd                           |
| S13 | Lid kent zichzelf de owner-rol toe                   | geweigerd                           |
| S14 | Rol van Org B toewijzen binnen Org A                 | geweigerd                           |
| S15 | Update van `ride_events`                             | geweigerd (3 lagen)                 |
| S16 | Delete van `audit_logs`                              | geweigerd                           |
| S17 | Platformbeheerder leest `clients`                    | 0 rijen (bewust)                    |
| S18 | Anonieme gebruiker leest willekeurige tabel          | 0 rijen                             |
| S19 | Tweede NFC-scan op dezelfde rit                      | geen tweede event; nette melding    |
| S20 | Tag-token van Org B gebruiken binnen Org A           | geweigerd                           |
| S21 | Verwijderd/gesuspendeerd lid bevraagt de organisatie | direct 0 rijen, geen JWT-vertraging |
| S22 | Ouder (geen lid) leest branding van de vervoerder     | toegestaan; andere organisatie 0 rijen |
| S23 | Chauffeur wijzigt de huisstijl                        | geweigerd (`branding.manage`)       |
| S24 | `logo_path` naar een andere organisatie of met `..`   | geweigerd door CHECK-constraint     |
| S25 | Upload buiten de eigen map in de logo-bucket          | geweigerd door storage-policy       |
| S26 | Domein toevoegen of verwijderen bij een andere tenant | geweigerd                           |
| S27 | Tenant zet zelf `verification_status = 'VERIFIED'`    | geweigerd door trigger              |
| S28 | Twee organisaties verifiëren dezelfde hostname        | tweede faalt op partial unique index |
| S29 | `branding_for_host` op een niet-geverifieerd domein   | 0 rijen; geen supportgegevens       |
| S30 | `branding_for_host` voor een gesuspendeerde organisatie | 0 rijen                           |
| S31 | Rapportage van organisatie A opvragen als lid van B  | 0 rijen                             |
| S32 | Rapportagefuncties zijn `security invoker`           | `prosecdef = false` in de catalogus |
| S33 | Chauffeur of ouder vraagt een organisatierapportage  | 0 rijen (`reports.view` ontbreekt)   |
| S34 | Platformbeheerder vraagt een rapportage              | 0 rijen (bewust, D-02)              |
| S35 | Deelsommen tellen op tot het totaal                  | per dag = per chauffeur = per cliënt |
| S36 | `report_by_client` bevat een afwezigheidsreden       | mag niet bestaan (D-25)             |
| S37 | Portaalrapportage buiten de eigen relatie            | 0 rijen                             |
| S38 | Export verwijderen uit de audit trail                | geweigerd                           |
| S39 | Platformbeheerder zonder grant                       | 0 rijen, overal                     |
| S40 | Operationele grant opent cliëntgegevens              | mag niet; alleen ritten en vloot    |
| S41 | Persoonlijke grant impliceert de operationele        | ja                                  |
| S42 | Verlopen of ingetrokken grant                        | 0 rijen                             |
| S43 | Grant aan iemand die geen platformmedewerker is      | 0 rijen                             |
| S44 | Support wijzigt iets, of verlengt zijn eigen grant   | geweigerd                           |
| S45 | Organisatie leest de grants van een andere           | 0 rijen                             |
| S46 | Chauffeur ziet het voertuig van zijn eigen rit       | ja; andere voertuigen niet          |
| S47 | Export van een cliënt van een andere organisatie     | leeg                                |
| S48 | Erasure door chauffeur, ouder of andere organisatie  | geweigerd; twee keer wissen is no-op |
| S49 | Erasure verwijdert ritten of auditregels             | mag niet; die blijven               |
| S50 | Erasure laat tag, koppeling of contactgegevens staan | mag niet; alles losgekoppeld        |
| S51 | Retentiesweep zonder dat de organisatie hem aanzette | 0 gewist                            |
| S52 | Tenant roept de retentiesweep zelf aan               | geweigerd                           |
| S53 | Zorgcoördinator leest zijn eigen zorgorganisatie     | ja (regressie op 0025)              |
| S54 | Rate limiter telt per subject en per bucket          | ja; boven de limiet geweigerd       |
| S55 | Pogingen ouder dan het venster tellen mee            | mag niet                            |
| S56 | Anon of ingelogde gebruiker roept de limiter aan     | geweigerd                           |
| S57 | Subject leesbaar opgeslagen; tabel groeit oneindig   | gehasht; sweep ruimt op             |
| S58 | Uitnodiger zonder `roles.manage` hangt een rol op het nieuwe lid | geweigerd                  |
| S59 | Dispatcher voegt zelf een collega toe                | geweigerd                           |
| S60 | Eigenaar van B zet iemand in organisatie A           | geweigerd                           |
| S61 | Iemand breidt zijn eigen rollen uit                  | geweigerd                           |
| S62 | Dezelfde persoon twee keer in dezelfde organisatie   | geweigerd door de unique constraint |
| S63 | Tenant leest `auth.users` om te zien of iemand bestaat | geweigerd                         |
| S64 | Nieuw auth-account levert een profielrij op          | ja, met naam uit de metadata        |
| S65 | Uitnodiging op een geweigerde poging                 | geen account, geen mail             |
| S66 | Planner geeft een eigen cliënt portaaltoegang        | ja                                  |
| S67 | Planner van B koppelt een account aan een cliënt van A | 0 rijen                           |
| S68 | Chauffeur geeft portaaltoegang                       | 0 rijen                             |
| S69 | Portaalgebruiker ziet alleen zijn eigen dossier      | ja; ritten van anderen 0 rijen      |
| S70 | Portaalgebruiker heeft een permissie                 | nee; `permitted_org_ids` leeg       |
| S71 | Portaalgebruiker koppelt zichzelf aan een tweede cliënt | 0 rijen                          |
| S72 | Planner ziet het adres van de gekoppelde portaalgebruiker | ja                             |
| S73 | Profiel dat aan niets hangt                          | onzichtbaar                         |
| S74 | Organisatie B ziet de portaalgebruiker van A         | onzichtbaar                         |
| S75 | Chauffeur ziet portaalprofielen                      | onzichtbaar                         |
| S76 | Dispatcher hangt een medewerker aan een zorgorganisatie | geweigerd                        |
| S77 | Toegang intrekken werkt onmiddellijk                 | ja; 0 rijen zichtbaar               |
| S78 | Contactpersoon van vervoerder B aan cliënt van A hangen | geweigerd                        |
| S79 | Opdrachtgever van vervoerder B aan cliënt van A hangen | geweigerd                         |
| S80 | Bestaande koppeling omzetten naar een vreemd contact-id | geweigerd                        |
| S81 | Koppelen binnen de eigen organisatie                 | ja (de regel blokkeert geen werk)   |
| S82 | Chauffeur koppelt een contactpersoon                 | geweigerd                           |
| S83 | Dispatcher koppelt een opdrachtgever                 | geweigerd                           |
| S84 | Chauffeur maakt een contactpersoon of opdrachtgever aan | geweigerd                        |
| S85 | Contactpersoon zonder `can_view_rides`               | 0 ritten zichtbaar                  |
| S86 | Opdrachtgever buiten de looptijd                     | 0 cliënten zichtbaar                |
| S87 | Opdrachtgever binnen de looptijd                     | ziet zijn eigen cliënten            |
| S88 | Zacht verwijderde contactpersoon                     | uit beeld; ritten blijven staan     |

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

**Bewaartermijnen (Fase 12, gebouwd):** `retention_policies` per organisatie met
`inactive_client_months` en een schakelaar die **standaard uit staat**. Staat hij
aan, dan anonimiseert de nachtelijke job cliënten zonder recente rit. Ritten en
events blijven; de persoon verdwijnt eruit (zie `DATABASE.md` §10).

**Rechten van betrokkenen (Fase 12, gebouwd):** op de cliëntpagina staat een
kaart Privacy met een volledige export (JSON, AVG art. 15/20) en wissen (art.
17). Beide schrijven een auditregel. Wissen anonimiseert de cliënt, wist
contactpersonen die nergens anders aan hangen, koppelt NFC-tags los en
verwijdert de portaal-login uit `auth.users`.

Wees eerlijk over de grens daarvan: een rit verwijst nog steeds naar een
cliëntrij. Anonimiseren betekent *dit systeem kan niet meer zeggen wie dit was*,
niet *dit is nooit gebeurd*. Wie een oude export naast de database legt, kan ze
alsnog naast elkaar leggen.

**Logging:** geen namen, adressen of e-mailadressen in applicatielogs. We loggen
id's. Dit is een reviewregel, geen aanbeveling.

**Besloten (D-03, 2026-08-28):** vervoersbehoeften staan **niet** op de cliënt.
De `clients`-tabel bevat geen `transport_requirements` en geen vrij
notitieveld. De behoefte (rolstoel, rollator, begeleiding) staat als gesloten
enum op de **rit**, waar hij operationeel thuishoort: het bepaalt welk voertuig
nodig is.

Dat is de meest data-minimale invulling die het product nog laat werken. Wees
wel eerlijk over wat het niet oplost: een rit is gekoppeld aan een genoemde
cliënt, dus "deze rit vereist een rolstoelbus" blijft herleidbaar tot een
persoon. De winst zit erin dat het gegeven geen doorzoekbaar kenmerk van de
persoon is, niet in de cliëntexport zit, en met de rit verdwijnt volgens de
bewaartermijn in plaats van permanent aan het dossier te blijven hangen.

Er is bewust **geen vrij tekstveld** voor vervoersinstructies. Verwacht dat
planners daar om zullen vragen; dat verzoek hoort langs dit besluit te lopen en
niet stilletjes als "kleine toevoeging" in een formulier te belanden.

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
- **Uploads:** logo's naar Supabase Storage. Het bestandstype wordt bepaald uit
  de **magic bytes**, niet uit de opgegeven Content-Type of de extensie; SVG
  wordt volledig geweigerd (een SVG is een document dat script kan bevatten en
  zou als logo op elke pagina van die tenant stored XSS opleveren). Maximaal
  512 kB. De bestandsnaam van de gebruiker wordt weggegooid: het object heet
  altijd `<organization_id>/logo.<ext>`, wat tegelijk de tenantgrens in de
  storage-policy is.
- **Rate limiting:** login, wachtwoordreset, tag check-in en portaalacties.
- **CSV-export:** het exporteerpunt accepteert alleen een rapportagesoort uit een
  vaste lijst en een periode. Geen kolomkeuze, geen filter, geen query uit de
  URL — een exportendpoint dat een query samenstelt uit invoer van de gebruiker
  is hoe een rapportagefunctie verandert in een exfiltratiekanaal met een nette
  naam. Antwoorden gaan met `cache-control: no-store, private` en
  `x-robots-tag: noindex`.

## 11. Auditlogging

Geaudit worden minimaal: aanmaken/wijzigen/verwijderen van gebruikers, rollen en
permissies; wijzigingen aan cliënten en contacten; aanmaken, wijzigen en
annuleren van ritten; chauffeurtoewijzing; tag koppelen/ontkoppelen/vervangen;
elke `force_status`; wijzigingen aan organisatie-instellingen, branding en
domeinen; verlenen en gebruiken van support-toegang; export en erasure.

Auditlogs zijn append-only en voor normale gebruikers niet verwijderbaar (§37).
Ze bevatten veldnamen, geen oude en nieuwe persoonsgegevens.
