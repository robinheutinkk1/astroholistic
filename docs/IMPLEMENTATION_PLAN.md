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

## Fase 4 — Beheer-core ✅ afgerond

Opgeleverd:

- Dashboard met echte dagcijfers: geplande, afgeronde, onderweg zijnde en
  wachtende ritten, plus problemen, afwezigheid en ritten zonder chauffeur
- Cliënten, chauffeurs, voertuigen en locaties: lijst, aanmaken, wijzigen,
  verwijderen — met zoeken, paginering en bevestigingsdialoog
- Auditlogging op elke mutatie
- Gedeelde bouwstenen: `lib/pagination.ts`, `Table`, `SearchField`,
  `Pagination`, `Select`, `DeleteDialog`, `lib/errors/form-state.ts`

_Verificatie:_ `npm run verify` groen (99 tests), `npm run test:security` groen
(128 tests). Alle routes gecontroleerd tegen de draaiende dev-server, zonder
fouten in de log.

**Server-side lijsten vanaf het begin.** Zoeken, sorteren en pagineren gebeurt
in de database. De sorteerkolom komt nooit rechtstreeks uit de URL maar wordt
tegen een toegestane lijst gecontroleerd; een onbekende of kwaadaardige waarde
valt terug op de standaard. Zoektermen worden ge-escaped, zodat iemand die naar
`50%` zoekt niet alles terugkrijgt. Dertien tests dekken dit af, inclusief
onzin-parameters die pagina 1 moeten opleveren in plaats van een foutmelding.

**Een stabiele tiebreaker op elke lijst.** Zonder `order by ..., id` kunnen twee
cliënten met dezelfde achternaam tussen pagina's van plaats wisselen, waardoor
er één nooit getoond wordt.

**Verwijderen is soft delete.** Een cliënt verdwijnt uit de lijsten maar de
ritten blijven — dat is de vervoersadministratie. Het verwijderdialoog noemt dat
concreet ("de 42 bestaande ritten blijven bewaard") in plaats van "weet je het
zeker?".

**Chauffeurs met toekomstige ritten kunnen niet verdwijnen.** De planning zou
stilzwijgend zijn toegewezene verliezen; de service weigert en zegt hoeveel
ritten eerst opnieuw toegewezen moeten worden.

**Het cliëntformulier heeft bewust geen veld voor rolstoel of medische
opmerkingen** (besluit D-03). Er staat een zichtbare toelichting waarom, zodat
het geen omissie lijkt die iemand later "even" aanvult.

**Gevonden tijdens het bouwen:** `insert ... returning` vereist óók leesrecht.
Een planner mag een auditregel schrijven maar de auditlog niet lezen, dus
`recordAudit()` doet bewust geen `returning` — anders faalt elke mutatie die een
planner doet. Vastgelegd in een test met die uitleg.

## Fase 5 — Ritten en planning ✅ afgerond

Opgeleverd:

- Terugkerende ritten: aanmaken, wijzigen, stoppen — met een leesbare
  samenvatting ("Maandag t/m vrijdag") en overerving van de vervoersbehoefte
- Ritgeneratie: idempotent, additief, rollend venster van 60 dagen. Handmatig
  te starten door een planner en nachtelijks via Vercel Cron
- Planning: dagoverzicht met chauffeur- en voertuigtoewijzing per rit, plus
  tellers voor totaal, niet-toegewezen en geannuleerd
- Losse ritten aanmaken en wijzigen, annuleren, statuswijziging via de state
  machine, en de rit-tijdlijn met alle vastgelegde gebeurtenissen
- Conflictsignalering: dezelfde chauffeur of bus binnen 30 minuten op twee
  ritten

_Verificatie:_ `npm run verify` groen (130 tests), `npm run test:security` groen
(142 tests). Alle routes en de cron-authenticatie gecontroleerd tegen de
draaiende server.

**Drie echte bugs die de tests en de handmatige controle vonden:**

1. *De duplicaatbeveiliging was onbruikbaar voor `ON CONFLICT`.* De unique index
   was partieel, en PostgreSQL kan een partiële index niet inferren zonder
   dezelfde `WHERE`-clausule — die PostgREST niet meestuurt. De allereerste
   generatie zou zijn afgebroken met een constraint-fout in plaats van
   bestaande ritten over te slaan. Vervangen door een gewone unique index, die
   dankzij `NULLS DISTINCT` exact dezelfde semantiek heeft (migration 0016).

2. *Een terugkerende rit zonder dagen werd geaccepteerd.* `array_length('{}', 1)`
   geeft `NULL`, en een CHECK-constraint laat `NULL` door. Zo'n afspraak
   genereerde vervolgens stilzwijgend niets — een planner zou nooit ontdekken
   waarom. Ook aanwezig op `trip_templates` (migration 0017).

3. *De nachtelijke generatie zou nooit gedraaid hebben.* Twee oorzaken: de
   generatiefunctie gebruikte de sessie van de gebruiker, die er bij een
   cronjob niet is (RLS gaf dan nul templates terug), én de middleware stuurde
   `/api/cron/...` door naar de inlogpagina. Beide zijn opgelost; de route
   weigert nu met 401 zonder geldig geheim en met 503 als het geheim niet is
   ingesteld.

**Generatie is additief, en dat wordt uitgelegd.** Een wijziging aan een
terugkerende afspraak raakt al ingeplande ritten niet. Het bewerkingsscherm
toont daarom vooraf hoeveel toekomstige ritten er al staan en hoeveel daarvan
handmatig zijn aangepast, en de bevestiging na opslaan zegt het opnieuw.

**Conflictsignalering is adviserend, niet blokkerend.** Twee ophaalpunten een
kwartier na elkaar in dezelfde straat is prima; dwars door de stad niet, en het
systeem kan dat verschil zonder routeplanning niet zien. Blokkeren zou planners
leren om het systeem te omzeilen.

**Secrets worden apart gevalideerd.** Eén gezamenlijke validatie betekende dat
ritgeneratie weigerde te draaien omdat `TAG_TOKEN_PEPPER` — een Fase 7-geheim
dat hij nooit gebruikt — niet ingesteld was.

## Fase 6 — Chauffeurs-PWA ✅ afgerond

Opgeleverd:

- "Vandaag": losse ritten en groepsritten in één lijst, op tijd gesorteerd
- Ritdetail met één grote knop per stap, navigatie-deeplink, belknop en de
  toelichting van de locatie
- Groepsritscherm: stops in volgorde, per stop wie instapt en wie uitstapt, en
  **één keer "ik ben aangekomen"** voor de hele stop
- Afwezigheid met vaste redenen, probleemmelding, optionele GPS
- PWA: manifest, iconen, `standalone`, startpunt op `/driver`

_Verificatie:_ `npm run verify` groen (130 tests), `npm run test:security` groen
(166 tests, waarvan 23 nieuw voor de chauffeursflow).

**Autorisatie komt uit de toewijzing, niet uit een rol.** Een chauffeur heeft
noch `rides.dispatch` noch `rides.update` — die geven zouden hem elke rit in de
organisatie laten wijzigen. In plaats daarvan mag de chauffeur van een rit díe
rit door de workflow bewegen, en verder niets. Een aparte service, met RLS die
dezelfde grens onafhankelijk bewaakt.

**Wat de mutatietest hier liet zien.** Het verzwakken van alleen de
update-policy werd niet gevangen — omdat de select-policy het al blokkeert: de
chauffeur kan de rit van een collega niet eens vínden. Pas toen ik beide lagen
tegelijk verzwakte, vielen acht tests om. Dat is defence in depth die in de
praktijk werkt, maar het is ook een les over mutatietesten: een test kan om de
juiste reden slagen en toch de verkeerde laag pinnen.

**Eén knop tegelijk.** De hele workflow tegelijk tonen is hoe een chauffeur de
verkeerde knop raakt terwijl hij een deur openhoudt. Het scherm toont precies de
volgende stap; een test bewaakt dat er per status nooit twee kandidaten zijn.

**GPS blokkeert nooit.** Locatie wordt meegestuurd als de organisatie het
aanzet én het apparaat het geeft, met een harde time-out van vier seconden. Een
geweigerde of trage fix mag een chauffeur die naast de bus staat niet ophouden.

**Probleem melden verandert de status niet.** Een chauffeur die "de lift klemt"
meldt terwijl hij onderweg is, moet niet zijn rit uit de workflow getrokken
zien; de dispatcher beslist wat er gebeurt.

## Fase 7 — NFC en QR ✅ afgerond

Opgeleverd:

- Tags aanmaken met een 128-bits willekeurig token, gekoppeld aan een cliënt,
  uitschakelen, als verloren melden
- QR-code die dezelfde URL bevat als de NFC-tag — één systeem, geen tweede
  identifier en geen tweede intrekpad
- Publieke landingspagina `/t/[token]`
- Check-in als één databasefunctie: event én statuswijziging in dezelfde
  transactie
- Scanknop in de chauffeursapp: Web NFC waar beschikbaar, code overtypen altijd
- Rate limiting op scanpogingen

_Verificatie:_ `npm run verify` groen (158 tests), `npm run test:security` groen
(187 tests, waarvan 21 nieuw voor de scanflow).

**Een gevonden tag is waardeloos.** De URL bevat een 128-bits willekeurig token,
niet de leesbare code van het label — die is enumereerbaar. De database bewaart
alleen een gepepperde hash, dus een databasedump levert geen werkende tag-URL's
op. De pagina toont een niet-ingelogde bezoeker niets: geen naam, geen
organisatie, en geen bevestiging dát het token bestaat. Woord voor woord
dezelfde pagina als een willekeurige string, geverifieerd tegen de draaiende
server.

**Een echt lek dat de eigen test vond.** De eerste versie zocht eerst de tag op
en controleerde dáárna de chauffeur. Gevolg: een onbekend token gaf
`UNKNOWN_TAG`, maar een echt token van een ánder vervoersbedrijf gaf
`NO_ACCESS`. Dat verschil is een orakel — iedereen met een willekeurig
chauffeursaccount kon een echte TagPoint-tag onderscheiden van een verzonnen
code. Nu wordt eerst vastgesteld wie de beller is, en zijn "geen tag" en "niet
jouw tag" hetzelfde antwoord.

**Dubbel scannen is geen dubbele check-in.** Drie taps leveren één event op en
de melding "Jan is al ingecheckt om 08:27" — geen foutmelding, want de chauffeur
heeft niets fout gedaan.

**Scannen is identificatie, geen autorisatie.** Het token identificeert de tag;
het sessietoken identificeert de persoon. Alleen een chauffeur met een rit voor
die cliënt, vandaag, krijgt een naam te zien.

**De QR-encoder is met de hand geschreven, en teruggelezen.** Eén vaste
configuratie in plaats van een bibliotheek die elke modus aankan. De test
decodeert de matrix terug naar de oorspronkelijke URL, zodat een fout in
plaatsing of masking zichtbaar wordt in CI in plaats van pas op een telefoon —
al blijft een echte camera de enige manier om contrast en printkwaliteit te
bevestigen.

## Fase 8 — Realtime dispatch ✅ afgerond

Opgeleverd:

- Dispatchbord met de kolommen uit §29: probleem, wacht op vertrek, onderweg
  naar cliënt, wacht op cliënt, onderweg met cliënt, afgerond, niet gereden
- "Vraagt aandacht": problemen, chauffeurs die te lang voor de deur staan, en
  ritten waarvan de vertrektijd verstreken is zonder dat er iets beweegt
- Live bijwerken via Supabase Realtime, achter één hook (`useRideStream`)
- Dashboardcijfers werken zichzelf bij, ruimer gedebounced
- Zichtbare verbindingsindicator met terugval op polling

_Verificatie:_ `npm run verify` groen (174 tests), `npm run test:security` groen
(205 tests).

**Realtime signaleert, het levert geen data.** De hook zegt "er is iets
veranderd" en de pagina haalt opnieuw op bij de server. De alternatieve aanpak —
rijen uit de socket in React-state patchen — vraagt dezelfde joins die de server
al doet (cliëntnaam, locaties, chauffeur), en die in de browser opnieuw afleiden
is precies hoe twee versies van hetzelfde scherm uit elkaar gaan lopen.

**Een bord dat stilletjes stopt met bijwerken is erger dan een bord dat nooit
beweerde live te zijn.** De indicator toont de verbindingsstatus en het tijdstip
van de laatste wijziging; valt de verbinding weg, dan gaat het scherm over op
ververen elke 30 seconden en zegt dat er ook bij.

**Alleen ritten, ritgebeurtenissen en groepsritten worden gepubliceerd.**
Cliënten of chauffeurs publiceren zou persoonsgegevens naar elk open bord
streamen voor wijzigingen waar niemand op wacht. Een test bewaakt dat.

**Een echt lek dat de eigen test vond.** De test "een chauffeur ziet alleen zijn
eigen ritten" gaf er twee terug. Oorzaak: "welke cliënten mag ik zien" en
"welke ritten mag ik volgen" gebruikten dezelfde helper. Chauffeur Kees rijdt
Jan om 08:00 — daardoor werd Jan zichtbaar voor Kees, wat klopt. Maar het toonde
hem óók de groepsrit van 16:00 die een collega rijdt: andermans planning én
Jans volledige dagpatroon, dat `SECURITY.md` §1 net zo gevoelig noemt als een
adres. Nu zijn het twee helpers, en bereikt een chauffeur een rit uitsluitend
via de toewijzing (migration 0020).

**Wat hier niet getest kon worden:** de levering zelf. Supabase Realtime is een
aparte dienst die het replicatielogboek leest en per abonnee RLS herbeoordeelt;
die heeft de Docker-stack nodig. Wél getest is alles waar hij van afhangt: wat
er gepubliceerd wordt, of die tabellen RLS aan hebben, en of de policies die hij
raadpleegt de organisaties daadwerkelijk scheiden.

## Fase 9 — Portalen ✅ afgerond

Opgeleverd:

- Eén portaal op `/portaal` voor cliënten, contactpersonen en opdrachtgevers:
  komende en eerdere ritten, status, chauffeursvoornaam
- Wijzigingsverzoeken en afmeldingen indienen, met de status van elk verzoek
- Beoordelingsscherm voor planners op `/verzoeken`

_Verificatie:_ `npm run verify` groen (174 tests), `npm run test:security` groen
(227 tests, waarvan 22 nieuw voor de portalen).

**Eén portaal, geen drie.** Het masterprompt beschrijft een cliëntportaal (§31),
een ouderportaal (§32) en een opdrachtgeverportaal (§33). Functioneel zijn dat
hetzelfde scherm: "de mensen wier vervoer ik mag volgen, hun ritten, en het
handjevol dingen dat ik mag doen". Alleen de bevoegdheden verschillen, en die
staan al op de koppelingen. Drie bijna identieke schermen zouden drie plekken
zijn om een fout te herstellen, en drie kansen dat er één lekt.

Een gebruiker kan bovendien meerdere rollen tegelijk hebben — een ouder die zelf
ook cliënt is. Bevoegdheden tellen dan op in plaats van dat de laatst geladen
rij wint.

**Portalen schrijven nooit in ritten** (besluit D-08). Wat een ouder invult is
een verzoek; een planner beslist. Zonder dat zou een afmelding om 05:00 stil een
planning omgooien waar nog niemand naar gekeken heeft, zonder spoor van wie het
deed. Vier tests bewaken dat, en RLS weigert het — niet alleen de knop is weg.

**Goedkeuren wijzigt de rit niet.** Het legt het besluit vast; de planner past
de rit daarna zelf aan. "Deze rit annuleren" van een ouder en van de planning
zijn niet dezelfde handeling — bij de tweede is er iemand verantwoordelijk voor
het gevolg. Het scherm zegt dat er ook bij.

**Niemand beoordeelt zijn eigen verzoek**, ook niet met de permissie. Anders kan
een medewerker die óók ouder is zijn eigen wijziging goedkeuren.

**Bevoegdheden staan op de koppeling, niet op de persoon.** Een ouder mag zich
voor het ene kind afmelden en voor het andere niet. Een opdrachtgever volgt het
vervoer maar spreekt niet namens de cliënt, en krijgt daarom geen knoppen — met
een zin die uitlegt waarom, in plaats van dode knoppen.

**Toegang vervalt vanzelf.** Zet een organisatie `can_view_rides` uit, dan is de
ouder direct buiten. Loopt de financiering van een opdrachtgever af, dan
verdwijnt de cliënt uit zijn lijst zonder dat iemand iets hoeft op te ruimen.
Beide getest.

## Fase 10 — White label en domeinen ✅ afgerond

Opgeleverd:

- `/instellingen/branding`: weergavenaam, twee kleuren, supportgegevens en
  logo-upload naar de publieke storage-bucket `organization-logos`
- `/instellingen/domeinen`: eigen domeinnamen toevoegen, het TXT-record dat
  gepubliceerd moet worden, verifiëren, hoofddomein kiezen en verwijderen
- Branding toegepast op **alle** shells: de root-layout leest de host, en de
  planner-, chauffeurs- en portaalshell overschrijven dat met de organisatie
  van de ingelogde gebruiker
- Migratie 0021: storage-bucket en -policies, `logo_path`/`favicon_path` met een
  exacte CHECK-constraint, uniciteit van domeinnamen pas bij `VERIFIED`, een
  trigger die zelfverificatie blokkeert, en `public.branding_for_host()`

_Verificatie:_ `npm run verify` groen (225 tests), `npm run test:security` groen
(265 tests, waarvan 38 nieuw voor branding en domeinen). Vijf mutatietests
uitgevoerd — prefixcheck in plaats van exact patroon, storage-policy zonder
mapcontrole, trigger verwijderd, `branding_for_host` zonder `VERIFIED`-filter, en
branding leesbaar voor elke ingelogde gebruiker — alle vijf gaven falende tests.

**De host bepaalt wat er geverfd wordt, nooit wat er gelezen mag worden.** De
Host-header is door de bezoeker te kiezen. Hij mag daarom alleen een naam, een
logo en twee kleuren opleveren, en alleen voor een domein waarvan het eigendom
met een DNS-record is aangetoond. Tenantscope blijft komen uit het lidmaatschap
en uit RLS.

**Een pad in plaats van een URL.** `logo_url` was vrije tekst, en een beheerder
mag die kolom schrijven — ook buiten het formulier om. Zo'n URL komt terecht in
een `<img src>` op een portaalpagina die andermans ouders bekijken. De kolom
bevat nu een opslagpad dat een CHECK-constraint exact vastpint; de URL wordt in
code samengesteld. Zie docs/DATABASE.md voor waarom een prefixtest niet volstaat.

**Niet gebouwd, bewust:** automatische TLS-certificaten en de DNS-/CDN-koppeling
zelf. Dat is platformconfiguratie (bij Vercel: een wildcard-domein plus de
Domains API) en geen applicatiecode; het staat in docs/DEPLOYMENT bij Fase 14.

**Niet lokaal te testen:** de daadwerkelijke upload naar Supabase Storage en het
opvragen van een echt TXT-record. Storage draait als losse dienst en Docker-images
zijn in deze omgeving geblokkeerd; de DNS-lookup is daarom achter een
injecteerbare resolver gezet zodat elke uitkomst wél getest is. De regels die de
tenantgrens bewaken — de storage-policies, de CHECK-constraint, de trigger en de
RPC — draaien in de database en zijn volledig getest.

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
