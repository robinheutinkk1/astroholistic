# Beslispunten, aannames en risico's

> Het masterprompt (§70) vraagt expliciet: _"Als je merkt dat een beslissing
> grote gevolgen heeft voor schaalbaarheid, security, GDPR, multi-tenancy of
> toekomstige SaaS-functionaliteit, STOP dan en benoem het."_
>
> Dit document is dat moment. **D-02 en D-03 zijn op 2026-08-28 besloten**
> (zie hieronder). Openstaand is nog **D-03a**. De overige besluiten zijn
> genomen met de genoemde onderbouwing en kunnen worden teruggedraaid.

---

## Besloten op 2026-08-28

### D-02 — Platformbeheerders krijgen géén toegang tot cliëntgegevens

**✅ BESLOTEN: optie (a) — geen toegang, `support_access_grants` in Fase 12.**
**Impact: security, GDPR, supportproces**

Ik heb ervoor gekozen dat een TagPoint-platformbeheerder via RLS **geen** rijen
uit `clients`, `contacts`, `rides` of `ride_events` kan lezen. Alleen
organisatiemetadata, abonnementen en aantallen.

_Waarom:_ jij bent verwerker, je klanten zijn verwerkingsverantwoordelijke. Als
één platformaccount alle tenants kan uitlezen, is dat account het enige wat
tussen een phishingmail en de persoonsgegevens van duizenden kwetsbare mensen
staat. Dat is een risico dat je als leverancier niet hoort te dragen en dat je
klanten in een verwerkersovereenkomst uitgesloten willen zien.

_Wat het kost:_ je kunt een supportvraag als "die rit staat verkeerd" niet zelf
in de data bekijken. Je ziet dat er een probleem is, maar niet welke cliënt het
betreft.

_Het alternatief dat ik voorstel:_ `support_access_grants` — de organisatie
verleent zelf tijdelijke inzage (bijv. 4 uur, met reden), automatisch
verlopend, volledig geaudit, zichtbaar voor de klant. Dat is in Fase 12 gepland.

**Consequenties die je moet kennen:**

1. Tot Fase 12 is er **geen** manier om als platformbeheerder in klantdata te
   kijken — ook niet bij een dringende supportvraag. De klant zal in die periode
   zelf moeten meekijken (schermdeling of een screenshot).
2. Debuggen van een datagerelateerde bug bij één klant gaat via logs met
   id's, niet met namen. Dat is trager maar werkbaar.
3. Dit is een sterk commercieel argument richting zorginstellingen en gemeenten:
   je kunt zwart op wit zeggen dat je leverancier niet in de cliëntgegevens kan.
   Zet het in je verwerkersovereenkomst.
4. Er komt onvermijdelijk een moment dat dit onhandig voelt. Het besluit
   terugdraaien mag, maar dan als expliciete wijziging van dit document — niet
   als "even een uitzondering".

---

### D-03 — Vervoersbehoeften en het AVG artikel 9-vraagstuk

**✅ BESLOTEN: optie (c) — per rit, niet per cliënt.**
**Impact: GDPR, productscope, datamodel**

§8 zegt "vermijd onnodige medische gegevens" en "maak hier geen medisch
dossiersysteem van". Tegelijk kun je zonder te weten dát iemand een rolstoel
heeft geen rolstoelbus inplannen. Die twee eisen botsen, en dat moet expliciet
worden opgelost in plaats van stilzwijgend.

Mijn voorstel: een gesloten enum `transport_requirements` met **uitsluitend
operationele** waarden — `WHEELCHAIR`, `WALKER`, `ASSISTANCE_TO_DOOR`,
`SEATBELT_SUPPORT`, `COMPANION_SEAT`. Geen diagnoses, geen indicaties, geen
medicatie. Plus een vrij veld `transport_notes` voor praktische instructies
("bel aan bij de achterdeur").

_Het risico:_ "gebruikt een rolstoel" is juridisch waarschijnlijk een gegeven
over gezondheid (AVG art. 9). Verwerking is verdedigbaar — zonder die informatie
kun je de dienst niet leveren — maar het vraagt een grondslag in de
verwerkersovereenkomst en strengere beveiliging dan gewone gegevens.
`transport_notes` is bovendien een vrij tekstveld, en dat betekent dat er vroeg
of laat "heeft epilepsie" in komt te staan. Dat is geen ontwerpfout maar een
voorspelbare gebruikersgewoonte, en het maakt van je platform ongewild een
gedeeltelijk zorgdossier.

_Mijn mitigatie:_ apart recht `clients.transport_notes.view`, zichtbare
waarschuwing in de UI ("geen medische informatie invullen"), maximaal 500
tekens, wijzigingen in de auditlog, en het veld verplicht meenemen in het
erasurepad.

**Wat er nu in het model staat:**

- `clients` bevat **geen** `transport_requirements` en **geen** vrij
  notitieveld. Alleen identificatie en contactgegevens.
- `rides.transport_requirements` is een gesloten enum-array: `WHEELCHAIR`,
  `WALKER`, `ASSISTANCE_TO_DOOR`, `SEATBELT_SUPPORT`, `COMPANION_SEAT`.
- Er is nergens een vrij tekstveld voor vervoersinstructies.

**Consequenties die je moet kennen:**

1. Het cliëntformulier krijgt geen veld voor "gebruikt rolstoel". Planners zullen
   daarnaar vragen. Dat verzoek hoort langs dit besluit te lopen, niet als
   "kleine toevoeging" in een formulier te belanden.
2. Bij het inplannen van een nieuwe rit weet het systeem niet uit zichzelf dat
   deze cliënt een rolstoelbus nodig heeft. De planner moet het aanvinken. Er is
   geen waarschuwing mogelijk bij vergeten, want het systeem heeft de
   informatie niet.
3. **Eerlijke kanttekening over de privacywinst.** Een rit is gekoppeld aan een
   genoemde cliënt. "Deze rit vereist een rolstoelbus" blijft dus herleidbaar
   tot die persoon. De winst is reëel maar bescheiden: het gegeven is geen
   doorzoekbaar of filterbaar kenmerk van de persoon, staat niet in de
   cliëntexport, en verdwijnt met de rit volgens de bewaartermijn in plaats van
   permanent aan het dossier te hangen. Optie (c) is dus geen ontsnapping aan
   AVG art. 9 — het beperkt de omvang en de vindbaarheid, niet het bestaan.
   Toets dit alsnog met een DPO voordat er echte klantdata in gaat.
4. Dit besluit maakt D-03a hieronder noodzakelijk.

---

## Genomen op basis van "doe je ding" (2026-08-28)

Deze punten stonden open toen je mij de vrije hand gaf. Ik heb ze ingevuld met
mijn advies. Alle vier zijn omkeerbaar; zeg het als je iets anders wilt.

### D-03a — Erven gegenereerde ritten de vervoersbehoefte van hun template?

**Impact: bruikbaarheid van terugkerende ritten, GDPR**

Volgt rechtstreeks uit D-03. Een cliënt met twee ritten per werkdag levert ruim
**500 ritten per jaar** op. Als de vervoersbehoefte alleen op de losse rit staat
en nergens vandaan komt, moet een planner bij elk van die 500 ritten opnieuw
"rolstoel" aanvinken. Dat gebeurt niet — en het gevolg is een rit waar een
gewone bus op wordt gepland terwijl er een rolstoelbus nodig is. Dat is een
operationeel risico voor de cliënt, niet alleen een ergernis.

**Mijn voorstel:** het veld staat óók op `ride_templates` en wordt bij generatie
gekopieerd naar elke rit. De planner kan het per rit overschrijven (een
uitzondering blijft een uitzondering). De vervoersbehoefte hangt daarmee aan de
_vervoersafspraak_, niet aan de _persoon_.

**Wat het niet oplost:** een template hoort bij één cliënt, dus het gegeven
blijft herleidbaar. Zie de kanttekening bij D-03 punt 3 — dezelfde afweging.

**✅ Genomen op 2026-08-28 (optie a), op basis van "doe je ding".**
De vervoersbehoefte staat op `ride_templates` en wordt bij generatie naar elke
rit gekopieerd; per rit overschrijfbaar. Terug te draaien zolang Fase 2 nog niet
gemigreerd is — zeg het als je liever (b) wilt.

---

## Genomen besluiten (terug te draaien, met onderbouwing)

### D-01 — Repositorynaam

De repo heet `astroholistic`, het product `TagPoint Taxi Dispatch`. Er staat
geen `astroholistic`-code in. Advies: hernoemen vóór er externe developers of
klanten meekijken. Puur cosmetisch, blokkeert niets.

### D-04 — Geen organisatie-claim in het JWT

Organisatielidmaatschap wordt in RLS per query uit de database gelezen, niet uit
een JWT-claim.

_Waarom:_ een JWT blijft tot een uur geldig. Met een claim houdt iemand die net
uit een organisatie is verwijderd nog een uur toegang tot cliëntgegevens. Bij
een ontslagen medewerker is dat precies het verkeerde uur.

_Wat het kost:_ een extra indexlookup per query. Die kosten worden geneutraliseerd
door de `(select app.fn())`-conventie, waardoor Postgres de functie één keer per
statement uitvoert in plaats van één keer per rij (zie `SECURITY.md` §4). Bij
gemeten problemen is een claim later alsnog toe te voegen, met een korte TTL en
een expliciet intrekmechanisme.

### D-05 — Geen aparte `qr_codes`-tabel

§39 noemt `qr_codes` als tabel, §21 eist dat NFC en QR niet twee systemen
worden. Ik volg §21: één tag, één token, één statusmodel; QR is een weergave.

_Waarom:_ met twee tabellen ontstaat de toestand "tag ingetrokken als NFC, nog
geldig als QR". Dat is een beveiligingsfout die je er dan zelf in bouwt.

### D-06 — Ritten worden gematerialiseerd, niet virtueel berekend

Terugkerende ritten genereren echte `rides`-rijen in een rollend venster van 60
dagen.

_Waarom:_ een rit draagt een chauffeur, voertuig, status, events en
uitzonderingen. Dat kan niet op een virtuele rij. Duplicaatpreventie zit op
databaseniveau (partiële unique index), niet in applicatielogica — twee
gelijktijdige jobs mogen niet allebei slagen.

_Gevolg dat je moet weten:_ een wijziging aan een template werkt **niet**
terugwerkend door in al gegenereerde ritten die handmatig zijn aangepast of die
`SCHEDULED` verlaten hebben. Dat is bewust (§15), maar het is wel gedrag dat
planners moet worden uitgelegd. De UI toont daarom bij het wijzigen van een
template expliciet hoeveel toekomstige ritten worden geraakt.

### D-07 — Lokale wandkloktijd is gezaghebbend

`ride_templates.departure_time` is een lokale tijd, niet een UTC-timestamp.

_Waarom:_ "elke werkdag om 08:00" betekent 08:00 op de klok, ook na de
zomertijdovergang. Sla je dat als UTC op, dan vertrekt de bus eind maart een uur
verkeerd. `rides` bewaart zowel de lokale tijd (gezaghebbend) als een afgeleide
`timestamptz` (om te sorteren en filteren).

### D-08 — Portalen schrijven nooit rechtstreeks in `rides`

Cliënten, ouders en opdrachtgevers maken een `change_request`; een planner
beoordeelt. Afmelden kan direct doorwerken als de organisatie dat aanzet, maar
ook dan blijft het verzoek als herkomst bewaard.

_Waarom:_ §32 eist het, en het voorkomt dat een ouder om 05:00 een rit annuleert
waar de planning al op gebouwd is, zonder spoor van wie dat deed.

### D-09 — Check-out is een event, geen status

De statuslijst blijft exact zoals §17 hem voorschrijft. Check-out wordt als
`CLIENT_CHECKED_OUT`-event vastgelegd en `ARRIVED → COMPLETED` wordt geblokkeerd
als de organisatie check-out verplicht heeft. Zo kan check-out per organisatie
uit, optioneel of verplicht zijn zonder dat de state machine verandert.

### D-10 — Realtime nu met `postgres_changes`, ontworpen voor broadcast

Alleen op dispatch en dashboard, achter één hook (`useRideStream`).

_Schaalwaarschuwing:_ `postgres_changes` evalueert RLS per abonnee per wijziging.
Bij honderden organisaties met meerdere dispatchers is dit het eerste knelpunt
dat je zult raken. De overstap naar Realtime Broadcast met een kanaal per
organisatie is bewust beperkt tot één bestand. We bouwen het nu niet — we maken
het goedkoop.

### D-11 — Chauffeurs krijgen geen `clients.view`

Een chauffeur ziet cliëntgegevens alleen in de context van een aan hem
toegewezen rit, binnen een venster van gisteren tot 7 dagen vooruit.

_Waarom:_ §4 eist het letterlijk. Het venster is een toevoeging van mij: een
chauffeur die vorig jaar één rit reed, hoort niet permanent het adres van die
cliënt te kunnen opvragen.

_Wat het kost:_ een chauffeur kan niet vooruit plannen buiten 7 dagen en kan een
cliënt niet opzoeken. Zeg het als dat operationeel knelt — het venster is een
instelling, geen aanname.

### D-12 — Verwijderen van personen gaat via anonimisering

Geen `ON DELETE CASCADE` op personen. Het GDPR-erasurepad wist de
persoonsvelden en laat ritten en events staan.

_Waarom:_ cascade-verwijderen van een cliënt zou duizenden ride-events wissen —
je vervoersadministratie én je audit trail. Anonimiseren voldoet aan het recht
op vergetelheid zonder de administratie te vernietigen. Wel te bevestigen met
je jurist: of anonimisering in jouw geval volstaat, hangt af van de
bewaarplichten die op je klanten rusten.

### D-13 — Documenten in `docs/`

§65 noemt de documenten zonder pad. Ik heb ze in `docs/` gezet en verwijs vanuit
`README.md`. Bij acht documenten wordt de root anders onleesbaar. Makkelijk te
verplaatsen als je ze liever in de root hebt.

---

### D-17 — Groepsvervoer krijgt een eigen laag (trips)
**Impact: datamodel, planning, chauffeurs-app**

Aanleiding: je gaf aan dat het platform vooral bedoeld is voor organisaties met
**meerdere cliënten per locatie** die daar ingecheckt worden. Het model had toen
alleen ritten per cliënt, zonder iets dat zei dat vijf ritten samen één busrit
zijn. Getest en bevestigd vóór de wijziging: vijf cliënten pasten in een bus met
zes plaatsen, maar negen ook, en dezelfde chauffeur kon om 16:00 op twee plekken
tegelijk worden ingepland.

Toegevoegd: `trips` (de rit van het voertuig), `trip_stops` (de stops in
volgorde) en `trip_templates` (terugkerend groepsvervoer). De per-cliënt
`rides`-rij blijft ongewijzigd — die korrel was goed.

*Waarom nu:* er hing nog geen enkel scherm aan het datamodel. Na Fase 5 en 6
hadden de planning én de chauffeurs-app opnieuw gebouwd moeten worden.

*Wat het oplevert:* capaciteitscontrole op zitplaatsen en rolstoelplaatsen,
detectie van dubbelgeboekte chauffeurs en voertuigen, één "ik ben aangekomen"
per stop in plaats van per passagier, en één terugkerend sjabloon per groep.

### D-18 — Inchecken kan met tag én handmatig afvinken
**Impact: chauffeurs-app, rapportage**

Elke cliënt houdt een eigen NFC-tag; de chauffeur tapt ze bij de deur na elkaar
en het scherm toont wie er nog mist. Daarnaast kan hij handmatig afvinken — voor
een cliënt die zijn tag vergeten is of al in de bus zit.

*Het risico dat je moet kennen:* handmatig afvinken is makkelijker dan scannen,
dus als het niet uitmaakt zal het scannen op termijn verwateren en verdwijnt de
waarde van de tags. Daarom legt `rides.checked_in_method` en
`ride_events.source` vast welke route gebruikt is, en tonen de rapportages dat
verschil. Zo kan een organisatie zien of de tags daadwerkelijk gebruikt worden
in plaats van dat aan te nemen.

### D-19 — Chauffeurs bereiken een rit via de toewijzing, niet via de cliënt
**Impact: privacy, chauffeursscherm**

Gevonden tijdens Fase 8. "Welke cliënten mag ik zien" en "welke ritten mag ik
volgen" gebruikten dezelfde regel. Een chauffeur die Jan om 08:00 rijdt, zag
daardoor óók de groepsrit van 16:00 die een collega rijdt.

Dat is meer dan een schoonheidsfoutje: het toont andermans planning én het
volledige dagpatroon van een cliënt — waar iemand elke dag is en wanneer hij
niet thuis is. `SECURITY.md` §1 noemt dat net zo gevoelig als het adres.

Nu gescheiden in twee regels. Een chauffeur ziet de cliënt van zijn eigen rit
(nodig om hem op te halen), maar bereikt een rit uitsluitend via de toewijzing.
Portalen zijn ongewijzigd: een ouder volgt de cliënt en ziet dus wél beide
ritten van zijn kind.

### D-14 — Offline werken voor chauffeurs: niet in V1
**Impact: scope, chauffeurs-PWA**

Het datamodel ondersteunt het al: `ride_events` scheidt `occurred_at` (wanneer
het gebeurde) van `recorded_at` (wanneer de server het ontving). Een offline
wachtrij in de PWA is echter substantieel werk — conflictafhandeling,
achtergrondsynchronisatie, een UI die eerlijk toont wat nog niet verzonden is.

Ik bouw het **niet** in V1, maar de duurste beslissing (het datamodel) is al
goed genomen. Later toevoegen kost geen migratie van bestaande data.

*Risico dat je moet kennen:* als chauffeurs structureel in gebieden zonder
bereik werken — parkeergarages, kelders van zorginstellingen — dan is dit geen
uitstelbaar detail maar een blocker voor ingebruikname. Toets dit bij Taxi
Ontzorgd vóór Fase 6.

### D-15 — Geen dataimport in de planning
**Impact: ingebruikname**

Er is geen informatie over bestaande cliëntgegevens bij Taxi Ontzorgd, dus er
staat geen importfase in de planning. Blijkt er straks een Excel-bestand of een
export uit bestaande software te zijn, dan is dat een aparte fase mét AVG-toets
— geen bijzaak die tussendoor kan.

### D-16 — Domeinen pas in Fase 10
**Impact: geen, zolang de fasering gevolgd wordt**

Onbekend of `tagpoint.nl` in bezit is en waar de DNS staat. Dat blokkeert niets:
tot Fase 10 draait alles op `localhost` en Vercel-preview-URL's. De
host-resolutie is al gebouwd en getest (`src/lib/tenant/host.ts`), inclusief de
valstrik dat `app.nottagpoint.nl` niet als platformhost mag tellen.

---

## Aannames

| #    | Aanname                                                                                       | Als dit niet klopt                                                          |
| ---- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| A-01 | Nederlandse markt, Europe/Amsterdam, `nl-NL` als default; i18n voorbereid maar niet gebouwd   | Meertaligheid is dan Fase 4-werk, geen nabouw                               |
| A-02 | Één Supabase-project voor alle tenants (shared schema)                                        | Bij een klant die een eigen database eist, wordt dat een aparte deployment  |
| A-03 | Chauffeurs hebben een smartphone met browser; geen native app                                 | Web NFC blijft progressive enhancement                                      |
| A-04 | Cliënten zijn niet altijd digitaal vaardig; het cliëntportaal is lichtgewicht en optioneel    | Meer investering in dat portaal nodig                                       |
| A-05 | Ritvolume per organisatie: tientallen tot enkele honderden per dag                            | Bij duizenden per dag komt partitionering van `ride_events` eerder in beeld |
| A-06 | Geen koppeling met bestaande planningssoftware in V1                                          | Een import-/API-laag wordt dan Fase 11-werk                                 |
| A-07 | ~~Er is nog geen Supabase-project aangemaakt~~ — **bevestigd 2026-08-28**: er bestaat er geen | Niet meer van toepassing; zie "Infrastructuur" hieronder                    |

## Infrastructuur — stand van zaken (bevestigd 2026-08-28)

| Onderdeel                | Status                                                                                     | Wanneer nodig                     |
| ------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------- |
| GitHub-repository        | **Bestaat**: `robinheutinkk1/astroholistic`, branch `claude/tagpoint-taxi-dispatch-d69dpb` | Nu in gebruik                     |
| Supabase-project (cloud) | Bestaat niet                                                                               | Pas aan het eind van Fase 2       |
| Vercel-project           | Bestaat niet                                                                               | Fase 14 (of eerder voor previews) |
| Domein `tagpoint.nl`     | Onbekend                                                                                   | Fase 10                           |

**Belangrijk: het ontbreken van een Supabase-project blokkeert niets.**
De Supabase CLI draait een volledige lokale stack in Docker (Postgres, Auth,
Realtime, Storage). Fase 1 en Fase 2 — inclusief alle migrations, RLS-policies
en de complete beveiligingstestsuite — worden daar gebouwd en getest. Het
cloudproject is pas nodig om te deployen, en dan draaien dezelfde migrations
erop. Dat is ook de veiligste volgorde: de tenant-isolatie is dan al bewezen
voordat er ooit een database publiek bereikbaar is.

Node 22, npm en Docker zijn in de ontwikkelomgeving aanwezig en geverifieerd.

### D-20 — Branding bewaart een pad, geen URL
**Impact: beveiliging, white label**

`organization_branding.logo_url` was vrije tekst. Een beheerder heeft
`branding.manage`, dus RLS staat toe dat hij die kolom schrijft — en dat kan met
zijn eigen token rechtstreeks tegen PostgREST, dus "het formulier biedt dat veld
niet aan" is geen maatregel.

Die waarde belandt in een `<img src>` op portaalpagina's die ouders van *andere*
cliënten bekijken. In het gunstigste geval is dat een tracking pixel richting een
derde partij; in het slechtste geval een verzoek dat de browser van die ouder
namens hem uitvoert.

Vervangen door `logo_path`, met een CHECK-constraint die het pad exact vastpint
op `<organization_id>/logo.<ext>`; de URL wordt in code samengesteld. Een
prefixtest bleek niet genoeg — een browser lost `..` op vóór het versturen — en
dat is precies wat de mutatietest bij Fase 10 aantoonde.

*Consequentie:* `logo_url` en `favicon_url` zijn verwijderd in migratie 0021.
Een organisatie kan dus geen extern gehost logo meer opgeven. Dat is bedoeld:
een logo dat wij niet serveren, kunnen wij ook niet garanderen.

### D-21 — Een domeinnaam wordt pas exclusief na verificatie
**Impact: SaaS, misbruik tussen tenants**

`organization_domains.hostname` was globaal uniek. Daarmee kon één organisatie
de domeinnaam van een concurrent onbruikbaar maken door hem in te typen: de rij
bleef `PENDING`, maar de echte eigenaar kon hem nooit meer toevoegen.

Uniciteit geldt nu alleen bij `verification_status = 'VERIFIED'`. Twee
organisaties mogen dezelfde hostname claimen; wie hem als eerste met een
DNS-TXT-record bewijst, krijgt hem. De verliezer van die race krijgt een nette
melding in plaats van een fout.

*Het risico dat je moet kennen:* een organisatie kan nog steeds *zien* dat een
domeinnaam al geverifieerd is, doordat verificatie faalt met "al door een andere
organisatie geverifieerd". Dat is bewust — een generieke fout zou de beheerder
uren naar zijn DNS laten staren — en het lekt niets wat een DNS-lookup niet ook
vertelt.

### D-22 — "Mogelijk gemaakt door TagPoint" verbergen is nu voor iedereen
**Impact: SaaS, commercieel**

`hide_platform_branding` is instelbaar door elke organisatie met
`branding.manage`. In een afgemaakt SaaS-product hoort dit een betaalde
entitlement te zijn in `plans.limits` (§36).

Bewust uitgesteld en niet vergeten: de plangrenzen zelf zijn nog een skelet, en
één entitlement afdwingen zonder de rest van de plancontrole zou de indruk
wekken dat die controle bestaat. Hoort bij de fase waarin abonnementen echt
worden.

### D-23 — De DNS van het platform staat bij Strato; de keuze die telt komt later
**Impact: deployment, SaaS**

`tagpoint.nl` is in eigen bezit met de DNS bij Strato. Overstappen naar
Cloudflare is overwogen. Wat daarvan afhangt is minder dan het lijkt, en het
valt uiteen in drie losse dingen.

**1. Domeinverificatie hangt er niet van af.** Het TXT-record
`_tagpoint-verify.<hostname>` publiceert de *klant* bij zijn eigen provider. Waar
onze DNS staat, doet daar niets toe. Die kant is af (Fase 10).

**2. De DNS van `tagpoint.nl` zelf.** Strato volstaat: een A-record voor de apex
en een CNAME voor de platform-host is gewoon standaard DNS. Eén ding is het
nagaan waard vóórdat erop gebouwd wordt: **ondersteunt het Strato-paneel een
wildcard (`*.tagpoint.nl`)?** Dat is nodig zodra klanten een subdomein van het
platform krijgen (`klant.tagpoint.nl`). De code houdt daar al rekening mee —
`checkHostname()` weigert een claim op een subdomein van de platform-host, juist
omdat die door het platform worden uitgedeeld — maar het uitdelen zelf is nog
niet gebouwd.

**3. Wie het certificaat uitgeeft voor `vervoer.klant.nl`.** Dit is de enige
echte keuze, en hij gaat niet over de DNS-provider maar over de hostingpartij:

- **Hostingpartij regelt het** (bij Vercel: de Domains API). De klant CNAME't
  naar de hostingpartij, die het certificaat uitgeeft. Onze DNS-provider doet
  niet mee, en `tagpoint.nl` kan bij Strato blijven staan.
- **Cloudflare for SaaS.** Dan moet `tagpoint.nl` als zone *wel* bij Cloudflare
  staan. De klant CNAME't naar een fallback-origin en Cloudflare geeft het
  certificaat uit.

**Besluit: nu niets verhuizen.** Een DNS-verhuizing is een half uur werk en kan
op elk moment; nu overstappen levert nog niets op omdat de hostingkeuze nog niet
gemaakt is. Beslissen bij Fase 14, in die volgorde: eerst hosting, dan DNS.

*Het risico dat je moet kennen:* welke route het ook wordt, de applicatie moet de
hostname van de **bezoeker** in de `Host`-header zien. Zit er een proxy tussen
die de header naar de origin-host herschrijft, dan vindt `branding_for_host()`
niets en vallen alle tenants stil terug op platformstyling. Dat faalt zonder
foutmelding, dus het hoort in de opleveringscontrole van Fase 14.

### D-24 — Chauffeurscijfers zijn operationeel, geen beoordeling
**Impact: privacy van medewerkers, arbeidsrecht**

Het masterprompt vraagt om "chauffeurprestaties". Dat is een legitieme
operationele vraag — welke routes lopen structureel uit, waar is de planning te
krap — en tegelijk de bouwsteen van een beoordelingssysteem.

Wat er gebouwd is: aantallen en punctualiteit per chauffeur, gesorteerd op
volume, met de noemer erbij ("7 van 9 gemeten"). Wat er *niet* gebouwd is: een
score, een ranglijst, een sortering op punctualiteit, of een signaalkleur bij
een slechte week.

*Het risico dat je moet kennen:* zodra deze cijfers in een
beoordelingsgesprek belanden, is het monitoring van werknemers. Dan gelden
andere regels: de ondernemingsraad heeft instemmingsrecht op een
personeelsvolgsysteem (WOR art. 27), en er hoort een grondslag en een
transparante uitleg aan de chauffeurs bij. Dat is een keuze van de
organisatie, niet van dit product — maar het product moet die keuze niet
ongemerkt vóór hen maken, en daarom staat er geen score in.

Wil je toch een ranglijst, zeg het: het is een klein stukje werk, maar dan
hoort de AVG-toets erbij.

### D-25 — Geen afwezigheidsredenen per cliënt in rapportages
**Impact: AVG, gezondheidsgegevens**

`absence_reason` kent de waarde `ILL`. Per rit is dat operationeel: de planner
moet weten waarom een rit niet doorging. Een *rapportage* die per cliënt telt
hoe vaak "ziek" voorkwam, is iets anders — dat is een gezondheidsdossier,
opgebouwd uit losse feiten die elk op zichzelf onschuldig leken.

Gezondheidsgegevens zijn een bijzondere categorie (AVG art. 9) en dit product
houdt ze bewust niet bij (§8, §38, D-03). `report_by_client()` heeft daarom geen
redenkolom, en de securitysuite controleert dat de kolom er niet is (S36) — niet
alleen dat hij nu leeg is.

De organisatiebrede uitsplitsing bestaat wél: `report_absence_reasons()`
beantwoordt "waarom vallen ritten uit?" zonder iemand te profileren.

*Consequentie die je moet kennen:* wie wil weten waarom één specifieke cliënt
vaak uitvalt, moet de ritten zelf bekijken. Dat is trager, en dat is het punt.

### D-26 — De grens voor "op tijd" ligt op vijf minuten
**Impact: rapportage, verwachtingen**

Punctualiteit wordt gemeten als het verschil tussen de geplande ophaaltijd en de
daadwerkelijke check-in, met een marge van vijf minuten. Vijf is een oordeel,
geen feit. Het staat op één plek (`app.punctuality_grace()`), zodat het één
wijziging is als jullie er anders over denken.

Twee dingen die de cijfers beïnvloeden en die je moet weten:

- Alleen ritten mét een check-in tellen mee. Een geannuleerde rit is niet "op
  tijd"; die meerekenen zou elk percentage mooier maken dan het is.
- De meting hangt aan de check-in, dus aan het moment waarop de chauffeur scant
  of afvinkt. Vinkt een chauffeur pas bij het wegrijden af, dan lijkt hij te
  laat. Dat is een reden te meer om geen beoordeling aan deze cijfers te hangen
  (D-24).

### D-27 — Support-toegang kent twee maten, en de tenant kiest
**Impact: privacy, support, D-02**

D-02 stelde support-grants uit. Fase 12 maakt ze echt, met een keuze erin.

Eén enkele grant zou hoe dan ook verkeerd zijn. "Support ziet alles" betekent
dat een engineer het huisadres van een kind leest om een planningsbug op te
lossen. "Support ziet niets persoonlijks" betekent dat het ticket "er wordt een
verkeerd adres gebruikt voor Jan" niet te beantwoorden is. Daarom kiest de
organisatie per keer tussen `OPERATIONAL` (ritten, gebeurtenissen, vloot,
instellingen) en `PERSONAL` (ook cliënt- en contactgegevens). De kleinste staat
voorgeselecteerd.

Verder: alleen-lezen, tijdgebonden met een korte lijst duren in plaats van een
datumkiezer, in te trekken, en elke verlening staat in de audit trail met de
opgegeven reden.

*Het risico dat je moet kennen:* een grant is een momentopname van vertrouwen.
Wie hem eenmaal heeft, kan gedurende die uren alles lezen wat binnen de scope
valt — er is geen controle per record en geen "support keek naar deze cliënt"-
regel per inzage. Wil je dat, dan is dat een aparte bouwstap (toegangslogging op
leesniveau) met een merkbare prestatieprijs.

### D-28 — Automatisch anonimiseren staat standaard uit
**Impact: AVG, vertrouwen**

`retention_policies.auto_anonymize_enabled` is `false` bij een nieuwe
organisatie. Een product dat vanzelf begint met het wissen van gegevens van een
klant die daar nooit voor koos, heeft een beslissing voor hen genomen die niet
terug te draaien is.

De keerzijde is even eerlijk: een organisatie die de schakelaar nooit aanzet,
bewaart persoonsgegevens langer dan de AVG toestaat, en zij zijn daarvoor
verantwoordelijk — niet wij. Het scherm zegt dat, maar een zin op een scherm is
geen naleving.

*Overweeg later:* een melding wanneer er cliënten zijn die langer dan de
ingestelde termijn inactief zijn terwijl de automaat uit staat. Dat maakt de
keuze zichtbaar zonder hem voor hen te maken.

### D-29 — Rate limiting staat in de database, niet in het geheugen
**Impact: beveiliging, prestaties**

De voor de hand liggende implementatie is een `Map` in modulescope. Die is hier
waardeloos: de app draait als serverless functies, dus elke instantie houdt zijn
eigen teller bij en een aanvaller die zijn verzoeken over tien koude starts
verdeelt krijgt tien keer de ruimte.

Dus een tabel. `consume_rate_limit()` is `security definer` en uitsluitend
uitvoerbaar door de service role — als `anon` erbij kon, kon een aanvaller een
limiet van een miljoen meegeven, of erger, de ruimte van iemand *anders*
opbranden en hen uit hun eigen account sluiten.

De limiter **faalt open**: is de database onbereikbaar, dan wordt het verzoek
toegestaan en luid gelogd. Een rate limiter die zelf een storing wordt is erger
dan wat hij voorkomt.

*Het risico dat je moet kennen:* elke geweigerde poging kost nog steeds een
databasequery. Bij een echte aanval is dat belasting die je liever eerder
afvangt — bij de hostingpartij of een WAF. Dit is de laag die je zelf in de hand
hebt, niet de enige laag die je zou moeten willen.

### D-30 — De volumetest meet één grote tenant, niet honderd kleine
**Impact: prestaties, testwaarde**

De opdracht vraagt om 100 organisaties, 50.000 ritten en 500.000 events. Bij een
gelijke verdeling krijgt elke organisatie 500 ritten, en 500 rijen zijn snel hoe
je ze ook opvraagt — zo'n meting bewijst niets over de indexen.

Echte SaaS-belasting is scheef. Eén klant is een orde van grootte groter dan de
mediaan, en dat is de klant die de ontbrekende index vindt. Een vervoersbedrijf
met 40 cliënten die twee keer per dag rijden maakt ongeveer 20.000 ritten per
jaar. De generator zet daarom standaard 40% van de ritten in één organisatie
(`PERF_SKEW`), en de rapportagequeries draaien tegen díe organisatie.

*Wat je moet weten over de uitkomst:* alles blijft onder de 20 ms en er is geen
enkele sequentiële scan op een grote tabel. Dat is gemeten op één machine met
een warme cache en 161 MB data. Het zegt dat de indexen kloppen; het zegt niets
over gelijktijdigheid, connectiedruk of een koude cache op productiehardware.
Dat is een meting voor Fase 14, op de echte infrastructuur.

### D-31 — Overgeslagen E2E-tests in plaats van weggelaten of falende
**Impact: testcultuur**

De kritieke-padtests (plannen → rijden → inchecken → afronden) hebben een
ingelogde sessie nodig, en die komt van GoTrue — een container, en
Docker-images zijn in deze omgeving geblokkeerd.

Drie mogelijkheden, en twee ervan zijn slecht. Ze weglaten betekent dat niemand
ze schrijft zolang de omgeving niet meewerkt. Ze laten falen betekent dat
iedereen leert een rode run te negeren, en dan verbergt die run ook de volgende
échte fout.

Ze staan er dus, en ze slaan zichzelf over met de reden erbij. De controle is
één echte inlogpoging, niet een poortcheck: een bereikbare GoTrue zonder
seeddata zou een poortcheck doorstaan en daarna elke test laten falen om een
reden die niets met de code te maken heeft.

*Consequentie:* het kritieke pad is momenteel gedekt door de securitysuite (op
databaseniveau) en door unittests (op logicaniveau), niet door een klik-door-de-
applicatie-test. Dat gat sluit zodra `npm run db:start` ergens draait.

## Openstaande vragen aan jou

1. ~~Bestaat er al een Supabase-project?~~ **Beantwoord: nee.** Zie hierboven.
2. **Zijn er echte cliëntgegevens van Taxi Ontzorgd die geïmporteerd moeten
   worden?** Zo ja, dan hoort daar een importplan én een AVG-toets bij.
3. **Is er een DPO of jurist** die D-03 (gezondheidsgegevens) en D-12
   (anonimisering vs. verwijdering) kan toetsen?
4. ~~**Domeinen:** is `tagpoint.nl` in bezit en waar staat de DNS?~~
   **Beantwoord: in eigen bezit, DNS bij Strato.** Zie D-23 hieronder voor wat
   dat wel en niet bepaalt.
5. **Moeten chauffeurs offline kunnen werken?** Het datamodel (`occurred_at`
   los van `recorded_at`) ondersteunt het al, maar een offline-queue in de PWA
   is substantieel extra werk en hoort dan nu in de planning.
