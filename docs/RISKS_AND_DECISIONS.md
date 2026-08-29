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

De repo heette `astroholistic`, het product `TagPoint Taxi Dispatch`. Er stond
geen `astroholistic`-code in. **Opgelost: hernoemd naar `tagpoint-taxi-dispatch`.**
Het advies was hernoemen vóór er externe developers of
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
| GitHub-repository        | **Bestaat**: `robinheutinkk1/tagpoint-taxi-dispatch`, branch `claude/tagpoint-taxi-dispatch-d69dpb` | Nu in gebruik                     |
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

### D-32 — De koppeling met de hostingpartij zit achter een interface
**Impact: deployment, leveranciersafhankelijkheid**

Bewijzen dat een organisatie een domeinnaam bezit is ons probleem, en dat is
opgelost met een DNS-TXT-record. Een TLS-certificaat voor dat domein krijgen is
het probleem van de hostingpartij, en daar zijn twee plausibele antwoorden met
totaal verschillende code (D-23). Die keuze mag niet in de verificatielogica
lekken.

`verifyDomain()` roept daarom `attachDomain()` aan en weet verder van niets. Er
is een Vercel-implementatie en een handmatige standaard.

*Het risico dat je moet kennen:* zonder `HOSTING_API_TOKEN` verifieert een
domein wél maar wordt het niet aangezet. Dat
is bewust zichtbaar — de organisatie krijgt te lezen dat TagPoint het domein
aanzet — maar het is dan wel iemands taak om dat ook te doen. Zet die twee
variabelen, of maak er een vast onderdeel van je aanmeldproces van.

### D-33 — CI heeft nog nooit gedraaid
**Impact: kwaliteitsbewaking**

De workflow triggert op `main`, `develop` en pull requests. Er is alleen naar
`claude/tagpoint-taxi-dispatch-d69dpb` gepusht, zonder PR. Alles wat "CI moet
groen zijn" in deze documenten belooft, is tot nu toe lokaal gecontroleerd en
nooit door de pipeline zelf.

Dat is niet theoretisch gebleven: twee fouten die CI had moeten vangen, zijn
langs geglipt tot ze handmatig gevonden werden — een seedbestand dat niet meer
bestond (fase 13) en een lintstap die faalt op een schone checkout (fase 14).

*Wat je moet doen:* open een pull request naar `main` of `develop`, of voeg
`claude/**` toe aan de `push`-trigger. Zolang dat niet gebeurt is de
merge-blokkade op de securitysuite een afspraak, geen mechanisme.

### D-34 — Uitnodigen mag alleen wie óók rollen mag toekennen

*Situatie:* iemand toevoegen aan een organisatie is één handeling, maar bestaat
uit twee dingen: een lidmaatschap aanmaken (`organization.members.manage`) en er
een rol op hangen (`organization.roles.manage`). Die twee permissies zijn
bewust gescheiden — een kantoormedewerker mag mensen op non-actief zetten
zonder ook rechten te mogen uitdelen.

*Besluit:* het uitnodigingsscherm eist allebei. Wie alleen leden beheert ziet de
kaart niet.

*Waarom niet alleen `members.manage`:* dan was uitnodigen een omweg om rollen
uit te delen. De policy op `organization_user_roles` zou dat alsnog tegenhouden,
maar pas nádat er een account was aangemaakt en een mail was verstuurd naar
iemand die vervolgens nergens in kan. De weigering hoort te komen voordat er
post uitgaat.

*Wat dit kost:* een organisatie die de twee rollen echt wil scheiden, kan
niemand laten uitnodigen zonder hem ook rollen te laten uitdelen. Dat is een
bewuste versimpeling; een aparte "mag uitnodigen met een vaste rol"-permissie
is later toe te voegen zonder iets af te breken.

### D-35 — Een portaalgebruiker is geen lid van de organisatie

*Situatie:* een cliënt, een ouder en een zorgcoördinator moeten kunnen inloggen.
De verleiding is groot om daar rollen voor te maken: "rol cliënt", "rol ouder".

*Besluit:* dat gebeurt niet. Een portaalgebruiker staat in géén enkele
`organization_users`-rij en heeft daarmee letterlijk nul permissies. Wat hij
ziet komt uit de relatie — `clients.user_id`, `contacts.user_id`,
`care_organization_users` — en die relatie is ook wat RLS leest.

*Waarom:* een rol zit in hetzelfde stelsel als de rol van een planner. Eén
verkeerd vinkje in een rollenscherm is dan genoeg om een ouder de hele planning
te laten zien. Een relatie kan dat niet: er is geen vinkje dat `visible_client_ids`
opeens uitbreidt.

*Gevolg:* toegang intrekken is het weghalen van de koppeling, en werkt per
direct — RLS leest de relatie bij elke query opnieuw, er loopt geen sessie door.

*Getoetst:* S66–S71 en S77.

### D-36 — `profiles` gaat precies zo ver open als nodig om te tonen wie toegang heeft

*Situatie:* de vervoerder is verwerkingsverantwoordelijke en moet kunnen
aantonen welk e-mailadres bij welk dossier kan. Maar `profiles_select` liet
alleen jezelf en je collega's zien, en een portaalgebruiker is juist geen
collega. Het scherm kon dus "heeft toegang" tonen en nooit "wie".

*Besluit:* migratie 0028 voegt één clausule toe via
`app.linked_portal_user_ids()`: profielen die aan een eigen cliënt,
contactpersoon of zorgorganisatie hangen, en alleen voor wie de bijbehorende
leesrechten heeft.

*Waarom niet de service role:* dan zou de applicatie zelf beslissen wie dit mag
zien, en is de vraag niet meer aan de database gesteld. Nu weigert RLS het
profiel, en toont het scherm eerlijk niets.

*Wat dit niet doet:* het adressenboek van een andere vervoerder blijft dicht, en
een chauffeur ziet deze profielen niet — hij mag geen cliënten inzien. Getoetst
met S72–S75, inclusief een mutatietest waarin de policy is opengezet.

### D-37 — Een koppeling mag de tenantgrens niet oversteken (gat, gedicht)

*Wat er mis was:* de policies op `client_contacts` en
`client_care_organizations` controleerden alleen of de **cliënt** van jouw
organisatie was. Over de contactpersoon of de opdrachtgever aan de andere kant
zeiden ze niets. Een planner van vervoerder A kon dus, met een id dat hij ergens
vandaan had, een contactpersoon van vervoerder B aan zijn eigen cliënt hangen —
en omdat `app.visible_client_ids()` die koppeling leest, kreeg de
portaalgebruiker van die vreemde contactpersoon daarmee de ritten van een cliënt
van A te zien.

*Waarom dat toch ernstig is, ook al is er een insider voor nodig:* het
uitgangspunt van dit product is dat de database de scheiding bewaakt en niet het
scherm. Een verkeerd id uit een gekopieerde URL of een importscript is genoeg,
en dan is er niets wat het tegenhoudt.

*Wat er is gedaan:* migratie 0029 eist dat beide kanten in dezelfde organisatie
zitten, op insert én op update — die tweede is nodig, anders blijft de omweg
"koppel eerst netjes, wijzig daarna het id" open. Getoetst met S78–S80 en
mutatiegetest door de oude policies terug te zetten: alle drie de tests vallen
dan om.

*Gevonden:* tijdens het bouwen van de beheerschermen voor contactpersonen en
opdrachtgevers, niet door een test die er al stond. Dat is het eerlijke
antwoord: de suite dekte de kant van de cliënt, niet die van de koppeling.

### D-38 — De afspraken staan op de koppeling, niet op de persoon

*Situatie:* een contactpersoon kan aan meerdere cliënten hangen. Dezelfde moeder
regelt voor haar zoon alles en kijkt bij haar dochter alleen mee.

*Besluit:* `can_view_rides`, `can_report_absence` en `can_request_changes` staan
op `client_contacts` — per cliënt dus, niet op de persoon. Het scherm laat ze
ook per koppeling zien.

*Gevolg voor het portaal:* iemand met twee koppelingen krijgt de vereniging van
zijn rechten per cliënt, niet één rechtenniveau over alles heen. Dat zit al in
`getPortalAccess()`.

### D-39 — De route heet `/opdrachtgevers`, het datamodel `care_organizations`

*Situatie:* de navigatie verwees al naar `/opdrachtgevers`, maar die pagina
bestond niet — een 404 die niemand had gemerkt omdat er ook geen scherm was om
naartoe te gaan. Het datamodel noemt hetzelfde ding `care_organizations`.

*Besluit:* de URL en de schermtaal volgen de navigatie ("opdrachtgever": de
partij die betaalt), de tabellen en de code houden `care_organizations`. Een
tabel hernoemen kost een migratie en raakt policies, functies en tests; de winst
zou alleen cosmetisch zijn.

*Wat dit kost:* wie de code leest ziet twee woorden voor één begrip. Daarom
staat het hier.

### D-40 — Componenttests, omdat drie kapotte knoppen de productie haalden

*Wat er mis was:* drie dingen op het scherm zagen er goed uit en deden niets.

1. **Wisselen van organisatie** — een `<form>` in een Radix-menu-item.
2. **Uitloggen** — precies dezelfde constructie, in het accountmenu. Ik heb de
   eerste gerepareerd zonder te kijken of het elders ook stond. Dat had gemoeten.
3. **QR-code van een tag** — een link naar `/tags/{id}/qr`, een pagina die niet
   bestond en ook niet kón bestaan: van een tag bewaren we alleen een
   versleutelde afdruk, dus de server kan die link nooit opnieuw opbouwen.

*Waarom niets dit ving:* de logica eronder klopte, dus de unittests waren groen.
De E2E-suite die het wél zou zien slaat over zolang er geen ingelogde sessie is,
en die vereist een draaiende GoTrue die er in deze omgeving niet is. Tussen
"logica klopt" en "een browser met een sessie" zat een gat waar deze drie
fouten precies in pasten.

*Besluit:* componenttests met Testing Library, in jsdom. Die renderen de echte
component, klikken er echt op, en controleren dat de server action wordt
aangeroepen met de juiste gegevens. Geen sessie nodig, dus ze draaien overal —
inclusief in CI.

*Getoetst dat ze werken:* van elke test is de kapotte versie teruggezet en
gecontroleerd dat hij dan valt. Een test die niet omvalt bij de fout die hij
zou moeten vangen, is erger dan geen test.

*Wat dit niet vervangt:* jsdom is geen browser. CSP, echte navigatie en de
werkelijke server actions blijven het terrein van de E2E-suite, en die blijft
half overgeslagen tot er een omgeving met GoTrue is.

### D-41 — Een test die dode links vindt

*Situatie:* de zijbalk verwees maandenlang naar `/opdrachtgevers`, een pagina
die niet bestond. TypeScript ving het niet: `href` in de navigatiedefinitie is
een gewone string in een array, en de `Route`-typen van Next dekken alleen JSX.

*Besluit:* `tests/routes.test.ts` leest de routes uit de bestandsstructuur en
vergelijkt ze met elke hard ingetypte link en redirect in de broncode.

*Wat het meteen opleverde:* behalve `/opdrachtgevers` ook de QR-link hierboven.
Twee dode links in een codebase waarvan ik dacht dat hij af was.

*Grens:* de test kent alleen letterlijk ingetypte paden. Een volledig
samengestelde link (`` `/${soort}/${id}` ``) valt erbuiten. Dat is een bewuste
grens: liever een test die geen valse alarmen geeft dan een die iedereen
uitzet.

### D-42 — Uitloggen maakt ook de cache leeg

*Situatie:* `signOutAction` beëindigde de sessie en stuurde door naar `/login`,
en verder niets.

*Probleem:* de router van de browser houdt opgehaalde pagina's vast. Wie na het
uitloggen op "terug" drukte, kon de planning van de vorige gebruiker nog uit die
cache zien. De sessie was weg, het beeld niet. Op een gedeelde computer in een
taxicentrale is dat geen theoretisch scenario.

*Besluit:* `revalidatePath('/', 'layout')` vóór de doorverwijzing.

### D-43 — Een opdrachtgever heeft meerdere vestigingen

*Situatie:* Humankind is één opdrachtgever met vestigingen in Enschede, Hengelo
en Almelo. Die stonden in `locations` als losse adressen zonder enig verband, en
de vraag "hoeveel ritten reden we voor Humankind?" was daarmee niet te
beantwoorden zonder zelf te weten welke adressen bij elkaar hoorden.

*Besluit:* `locations.care_organization_id`, optioneel. Een woonadres, station
of ziekenhuis hoort bij niemand en houdt het veld leeg.

*Waarom op de locatie en niet andersom:* de verhouding is één opdrachtgever op
veel vestigingen. Een lijst vestigingen op de opdrachtgever zou een derde tabel
kosten voor precies dezelfde informatie.

*De tenantgrens:* een samengestelde foreign key op
`(organization_id, care_organization_id)`, niet een gewone naar `id`. Anders kon
een locatie van vervoerder A naar een opdrachtgever van vervoerder B wijzen, en
dat is hetzelfde gat dat D-37 op de koppeltabellen dichtte. Getoetst met S89.

*`on delete set null` en niet `cascade`:* een opdrachtgever die vertrekt mag
nooit de adressen meenemen waar nog ritten naartoe rijden.

### D-44 — "Voor een opdrachtgever" betekent ophalen én afleveren

*Situatie:* een rit heeft twee locaties. Bij het filteren op opdrachtgever moest
gekozen worden welke telt.

*Besluit:* allebei. Een rit telt mee als de ophaal- óf de bestemmingslocatie een
vestiging van die opdrachtgever is.

*Waarom:* het ophalen ná de dagbesteding is net zo goed een rit voor die
opdrachtgever. Alleen op bestemming filteren zou precies de helft van de cijfers
laten verdwijnen, en wel de helft die niemand mist tot de factuur niet klopt.

*Gevolg voor "per locatie":* de kolom Ritten telt op tot meer dan het totaal
bovenaan, want elke rit raakt twee locaties. Dat is geen fout maar de vraag: hoe
druk is deze vestiging.

*Eén uitzondering:* is er een opdrachtgever gekozen, dan toont "per locatie"
alleen diens vestigingen. Zonder die regel zou "Humankind, per locatie" ook alle
woonadressen tonen waar die ritten vandaan komen, en dat is een ander antwoord
dan de vraag.

### D-45 — `create or replace` vervangt geen functie met een nieuwe parameter

*Wat er bijna misging:* de rapportagefuncties kregen er twee parameters bij via
`create or replace`. Dat vervangt niets: het maakt een tweede versie naast de
oude. Postgres kan daarna niet kiezen tussen beide, en een aanroep met drie
argumenten treft de ongefilterde versie.

*Hoe het opviel:* een handmatige controle in psql gaf "function is not unique".
Was die aanroep wél eenduidig geweest, dan had het filter er in het scherm
uitgezien alsof het werkte terwijl er niets werd gefilterd.

*Besluit:* de oude signaturen expliciet droppen in de migratie, en een test die
faalt zodra er van een rapportagefunctie meer dan één variant bestaat.

### D-46 — Uitlegteksten uit de interface

*Situatie:* onder vrijwel elke kaartkop stond een zin die uitlegde wat de kaart
deed, en er stonden gedachtestreepjes doorheen. Voor de bouwer nuttig, voor een
klant die zijn eigen vak kent alleen ruis, en samen gaven ze het scherm de toon
van een handleiding in plaats van een werkinstrument.

*Besluit:* alle `CardDescription`-teksten en `hint`-teksten weg, en de
gedachtestreepjes uit zichtbare tekst.

*Wat blijft:* de bevestiging vóór iets onomkeerbaars ("de 42 bestaande ritten
blijven staan"), en de tekst in een leeg scherm. Dat eerste is geen uitleg maar
een gevolg, en het tweede is de enige inhoud die er op dat moment is.

*Wat dit niet raakt:* het commentaar in de code. Dat is voor de volgende
ontwikkelaar en komt nooit op een scherm.

### D-47 — De chauffeur blijft ingelogd, de rest niet

*Situatie:* één sessieduur voor iedereen past niet. Een planner werkt op een
computer die op kantoor blijft staan, vaak gedeeld, en die 's avonds aan blijft.
Een chauffeur heeft de app als PWA op zijn eigen telefoon, met een
schermvergrendeling ervoor, en moet om zes uur 's ochtends met handschoenen aan
kunnen inchecken.

*Besluit:* een inactiviteitsklok van vier uur op alle schermen behalve de
chauffeursapp. Vier uur haalt een werkende planner nooit, en een nacht standby
altijd.

*Waarom niet in Supabase instellen:* de sessieduur daar geldt voor het hele
project en kent geen onderscheid per rol. De klok zit daarom in de proxy, waar
elke aanvraag toch al langskomt.

*Waarom op pad en niet op rol:* de proxy draait bij elke aanvraag en het
opzoeken van een rol zou daar een databasevraag per klik kosten. Het gevolg is
te overzien: wie op een chauffeurspagina blijft staan houdt zijn sessie in
leven, maar zodra hij een plannerscherm opent geldt de klok weer, en dáár staat
de planning.

*Wat dit wel en niet is:* een slot op een onbeheerd scherm, geen
autorisatiegrens. Wie de sessiecookie in handen heeft, heeft de sessie; daar
verandert een tijdstempel niets aan. De echte grens blijft RLS en de
permissiecontrole.

*Er wordt echt uitgelogd,* niet alleen doorgestuurd: anders blijft de sessie bij
Supabase geldig en is één stap terug genoeg om er weer in te zitten.

*Een ontbrekende tijdstempel betekent "nu net begonnen" en niet "verlopen".*
Zonder die regel zou het invoeren van deze functie iedereen in één klap
uitloggen, en zou een chauffeur die voor het eerst een plannerpagina opent er
meteen weer uit vliegen.

*De gebruiker krijgt te horen waarom.* Automatisch uitloggen zonder uitleg ziet
eruit als een storing, en dat is precies het moment waarop mensen gaan bellen.

## Openstaande vragen aan jou

1. ~~Bestaat er al een Supabase-project?~~ **Beantwoord: nee.** Zie hierboven.
2. **Zijn er echte cliëntgegevens van Taxi Ontzorgd die geïmporteerd moeten
   worden?** Zo ja, dan hoort daar een importplan én een AVG-toets bij.
3. **Is er een DPO of jurist** die D-03 (gezondheidsgegevens) en D-12
   (anonimisering vs. verwijdering) kan toetsen?
4. ~~**Domeinen:** is `tagpoint.nl` in bezit en waar staat de DNS?~~
   **Beantwoord: in eigen bezit, DNS bij Strato.** Zie D-23 hieronder voor wat
   dat wel en niet bepaalt.
5. **Wie doet de eerste deploy, en wanneer?** `docs/DEPLOYMENT.md` staat klaar,
   maar er is in deze omgeving geen Vercel-account, geen Supabase-productie-
   project en geen DNS-toegang. De eerste echte deploy is een stap die jij zet.
6. **Moeten chauffeurs offline kunnen werken?** Het datamodel (`occurred_at`
   los van `recorded_at`) ondersteunt het al, maar een offline-queue in de PWA
   is substantieel extra werk en hoort dan nu in de planning.
