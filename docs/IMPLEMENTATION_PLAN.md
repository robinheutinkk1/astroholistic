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
chauffeursaccount kon een echte Tagpoint-tag onderscheiden van een verzonnen
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
zelf. Dat is platformconfiguratie en geen applicatiecode, en het hangt af van de
hostingpartij — hoort daarom bij Fase 14 (deployment). Wat de applicatie moet
doen zodra die keuze gemaakt is, is één ding: na een geslaagde verificatie de
hostname aanmelden bij de hostingpartij, zodat die een certificaat uitgeeft. Dat
haakje zit logisch in `verifyDomain()`, direct na `markVerified()`.

**Niet lokaal te testen:** de daadwerkelijke upload naar Supabase Storage en het
opvragen van een echt TXT-record. Storage draait als losse dienst en Docker-images
zijn in deze omgeving geblokkeerd; de DNS-lookup is daarom achter een
injecteerbare resolver gezet zodat elke uitkomst wél getest is. De regels die de
tenantgrens bewaken — de storage-policies, de CHECK-constraint, de trigger en de
RPC — draaien in de database en zijn volledig getest.

## Fase 11 — Rapportages ✅ afgerond

Opgeleverd:

- `/rapportages`: samenvatting over een periode (afgerond, niet gereden, op
  tijd), verdeling van check-inmethodes, redenen waarom ritten niet doorgingen,
  en tabellen per dag, per chauffeur en per cliënt
- CSV-export per tabel, met formule-neutralisatie en een auditregel per export
- `/portaal/rapportage`: aantallen per persoon voor een opdrachtgever, zoals
  docs/ROLES_AND_PERMISSIONS.md §6 belooft
- Migratie 0022: zes aggregatiefuncties in SQL, allemaal `security invoker`
- Seeddata uitgebreid met 132 afgeronde ritten over 60 dagen, deterministisch,
  zodat de schermen én de tests iets te rekenen hebben

_Verificatie:_ `npm run verify` groen (262 tests), `npm run test:security` groen
(291 tests, waarvan 26 nieuw). Vijf mutatietests uitgevoerd.

**Aggregeren gebeurt in de database, met de rechten van de aanroeper.** Elke
andere helper in het `app`-schema is `security definer`, want die moet een vraag
beantwoorden die de aanroeper zelf niet mag stellen. Rapportages zijn het
omgekeerde: ze tellen de eigen ritten van de aanroeper, dus moeten ze onder RLS
draaien. Eén ontbrekende `where`-regel in een `security definer`-rapportage is
een gat dwars door de tenantgrens.

**Twee mutatietests vonden een test die om de verkeerde reden slaagde.** Een
rapportagefunctie op `security definer` zetten brak geen enkele test: de
expliciete `reports.view`-controle in de functie leest de JWT van de aanroeper
en blijft de verkeerde organisatie weigeren, terwijl RLS op `rides` stilletjes
niet meer meedoet. Daarom wordt die eigenschap nu rechtstreeks uit de
`pg_proc`-catalogus geverifieerd (S32). Hetzelfde gold voor de `LEFT JOIN` in de
chauffeursrapportage: de seed had geen enkele rit zonder chauffeur, dus een
`INNER JOIN` viel niet op. De seed heeft nu geannuleerde ritten zonder
chauffeur, en de deelsommen worden vergeleken met het totaal (S35).

**Bewust niet gebouwd:** een uitsplitsing van afwezigheidsredenen per cliënt.
Zie D-25 — dat is een gezondheidsdossier via de achterdeur.

**Niet lokaal te testen:** niets van deze fase. Alles draait tegen de lokale
database, inclusief de export.

## Fase 12 — Hardening ✅ afgerond

Opgeleverd:

- Content-Security-Policy met een nonce per request, gezet in `src/proxy.ts`;
  extra headers (`X-Robots-Tag`, `Cross-Origin-Opener-Policy`)
- Rate limiting in de database, per adres én per account, op inloggen,
  wachtwoordherstel, portaalverzoeken en exports
- Support-toegang werkt echt: twee scopes, tijdgebonden, alleen-lezen, door de
  tenant zelf verleend en ingetrokken, met een scherm op
  `/instellingen/support`
- AVG-export (art. 15/20) en wissen (art. 17) per cliënt, op de cliëntpagina
- Bewaartermijnen per organisatie, standaard uit, uitgevoerd door de
  nachtelijke job
- Migraties 0023–0026; `docs/SECURITY_AUDIT.md` met de audit langs T1–T26

_Verificatie:_ `npm run verify` groen (271 tests), `npm run test:security` groen
(334 tests, waarvan 43 nieuw). Acht mutatietests uitgevoerd. `npm audit`:
0 kwetsbaarheden.

**Vier bevindingen, waarvan drie echte bugs.** Ze staan uitgewerkt in
`docs/SECURITY_AUDIT.md`; kort:

1. Een chauffeur kon een volledig cliëntdossier exporteren. RLS liet hem door,
   want een chauffeur mag de cliënt van zijn eigen rit lezen. Mogen zien wie je
   ophaalt is niet hetzelfde als het dossier mogen downloaden.
2. Twee policies verwezen naar elkaar en veroorzaakten oneindige recursie —
   alleen voor de rol waarvoor ze geschreven waren, want voor iedereen mét het
   recht sloot de eerste tak kort.
3. Tabellen die ná migratie 0010 zijn aangemaakt kregen geen grants. `grant on
   all tables` is een momentopname.
4. De CSP bestond alleen in een comment.

**En één die ik zelf maakte.** Migratie 0024 moest `vehicles_select` droppen en
opnieuw aanmaken om er één regel aan toe te voegen; de eerste versie verloor de
clausule waarmee een chauffeur het voertuig van zijn eigen rit ziet. Geen enkele
test ving dat op. Nu wel (S46).

**Support is alleen-lezen en in twee maten.** Eén grant "support ziet alles"
betekent dat een engineer het huisadres van een kind leest om een planningsbug
te vinden. Eén grant "support ziet niets persoonlijks" betekent dat het ticket
"er wordt een verkeerd adres gebruikt voor Jan" onbeantwoordbaar is. De tenant
kiest per keer; de kleinste optie is de standaard.

**Wat er niet is:** een geautomatiseerde test op de rate limiter (die draait via
de service-role-client, de suite praat rechtstreeks met PostgreSQL), en een
penetratietest door een derde. Beide staan in `docs/SECURITY_AUDIT.md` onder
"Wat nog niet af is".

## Fase 13 — Testen en stabilisatie ✅ afgerond

Opgeleverd:

- End-to-end suite met Playwright (`npm run test:e2e`), op desktop én mobiel,
  tegen een **productiebuild** — 22 tests die zonder authenticatiedienst draaien
- Volumetest (`npm run perf`): 100 organisaties, 50.000 ritten, 500.000 events,
  met `explain (analyze)` op de queries die het product echt doet, als
  ingelogde gebruiker mét RLS
- Rate-limitertests (S54–S57), het gat dat Fase 12 openliet
- CI gerepareerd en uitgebreid met een E2E-job en een dependency-audit

_Verificatie:_ `npm run verify` groen (271 tests), `npm run test:security` groen
(345 tests, waarvan 11 nieuw), `npm run test:e2e` 22 geslaagd en 12 overgeslagen.
Vijf mutatietests op de limiter.

**De CI-securityjob was al fasen kapot.** Hij draaide
`psql -f supabase/seed/seed.sql`, en dat bestand is in fase 6 gesplitst in
`00-auth-users.sql` en `10-demo-data.sql`. De job faalde dus op een ontbrekend
bestand in plaats van op een resultaat. Nu draait hij elk seedbestand op naam,
zodat splitsen of toevoegen hem niet opnieuw breekt. De exacte
CI-commandoreeks is lokaal nagespeeld: 345 tests groen.

**De E2E-suite vond meteen iets.** De publieke pagina's hadden geen `<h1>`. De
kaarttitel rendert als `<h3>`, dus login, wachtwoord vergeten en wachtwoord
herstellen hadden helemaal geen paginakop — een schermlezer kondigt zo'n pagina
zonder titel aan (§48). `CardTitle` heeft nu een `as`-prop; op die drie
pagina's is de kaarttitel de `h1`.

**Wat een E2E-test hier toevoegt.** Een unittest bewijst dat de CSP-tekst klopt.
Alleen een echte browser bewijst dat de applicatie er nog onder werkt — en
`strict-dynamic` met een nonce is precies het soort policy dat op papier klopt
en in de praktijk een witte pagina geeft. De suite laadt de loginpagina, vult
het formulier in, verstuurt een Server Action en controleert dat er geen enkele
CSP-overtreding en geen scriptfout optreedt.

**De volumetest meet één grote tenant, niet honderd kleine.** Een gelijke
verdeling geeft elke organisatie 500 ritten, en 500 rijen zijn snel hoe je ze
ook opvraagt — dat meet niets. Echte SaaS-belasting is scheef: 40% van de ritten
gaat naar één organisatie (20.300 ritten), want dat is de klant die de
ontbrekende index vindt. Resultaat: alles onder de 20 ms, geen enkele
sequentiële scan op `rides`, `ride_events` of `clients`, en de RLS-helpers
worden zoals bedoeld één keer per statement geëvalueerd (`InitPlan`, en de
meeste zelfs `never executed` door kortsluiting).

**Geen ontbrekende indexes gevonden.** Dat is een uitkomst, geen overslaan:
`rides_org_date_idx` uit migratie 0006 doet precies wat de rapportages nodig
hebben.

**Wat er niet is:** de kritieke-padtests (plannen → rijden → inchecken →
afronden) staan geschreven maar slaan zichzelf over zonder draaiende GoTrue, en
Docker-images zijn in deze omgeving geblokkeerd. Ze draaien zodra
`npm run db:start` werkt. Een overgeslagen test die uitlegt waarom is eerlijk;
een falende test die iedereen leert negeren is erger dan geen test.

## Fase 14 — Deployment ✅ afgerond

Opgeleverd:

- `docs/DEPLOYMENT.md`: van leeg account naar productie, met per stap een
  controle, een rookproef, monitoring, back-up, terugdraaien en een eerlijke
  lijst van wat er nog niet is
- `/api/health` voor monitoring: bewijst de hele keten tot en met onze eigen
  migraties, zonder iets prijs te geven
- `npm run check:env:production`: weigert onder andere een service-role key in
  een `NEXT_PUBLIC_`-variabele
- `DomainProvider` als naad: een Vercel-implementatie plus een handmatige
  standaard die zichtbaar zegt dat er nog een stap open staat
- De nachtelijke cronroute heet nu `/api/cron/nightly` in plaats van
  `generate-rides` — hij doet sinds fase 12 drie dingen

_Verificatie:_ `npm run verify` groen (278 tests, +7),
`npm run test:security` groen (345 tests).

**CI heeft nog nooit gedraaid.** De workflow triggert op `main`, `develop` en
pull requests, en er is alleen naar een featurebranch gepusht zonder PR. Dat
verklaart waarom de kapotte seedstap uit fase 13 zo lang onopgemerkt bleef — en
het legde in deze fase een tweede probleem bloot: op een schone checkout draait
`npm run lint` vóór `npm run build`, en zonder `.next/types` valt Next's `Route`
terug op `string`, waardoor elke `as Route`-cast als overbodig wordt gemeld en
lint faalt. Een ontwikkelaar ziet dat nooit, want diens `.next` is warm.
Opgelost met een `typegen`-stap vóór lint, in `verify` en in CI.

**De preflightcontrole vangt wat runtimevalidatie niet kan zien.** Een
service-role key in `NEXT_PUBLIC_SUPABASE_ANON_KEY` is een op zichzelf geldige
waarde; alleen de rol in het token verraadt hem. Staat hij daar, dan wordt de
sleutel die álle RLS omzeilt in de browserbundle gecompileerd.

**De domeinkoppeling zit achter een interface.** Bewijzen dat een klant een
domein bezit is ons probleem en dat is opgelost; er een certificaat voor krijgen
is dat van de hostingpartij, en die keuze staat nog open (D-23). Zonder
configuratie is de uitkomst `MANUAL` en niet stilzwijgend niets — een domein dat
verifieert en daarna niets serveert is de slechtste van de drie uitkomsten.

**Niet gedaan, en dat kan hier ook niet:** er is niet echt gedeployd. Er is geen
Vercel-account, geen Supabase-productieproject en geen DNS-toegang in deze
omgeving. Wat er ligt is de handleiding, de controles en de code die het
mogelijk maakt; de eerste echte deploy is jouw stap, met `docs/DEPLOYMENT.md`
ernaast.

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
