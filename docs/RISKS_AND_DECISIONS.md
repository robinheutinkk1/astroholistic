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

## Openstaande vragen aan jou

1. ~~Bestaat er al een Supabase-project?~~ **Beantwoord: nee.** Zie hierboven.
2. **Zijn er echte cliëntgegevens van Taxi Ontzorgd die geïmporteerd moeten
   worden?** Zo ja, dan hoort daar een importplan én een AVG-toets bij.
3. **Is er een DPO of jurist** die D-03 (gezondheidsgegevens) en D-12
   (anonimisering vs. verwijdering) kan toetsen?
4. **Domeinen:** is `tagpoint.nl` in bezit en waar staat de DNS? Dat bepaalt hoe
   custom domains in Fase 10 worden geautomatiseerd.
5. **Moeten chauffeurs offline kunnen werken?** Het datamodel (`occurred_at`
   los van `recorded_at`) ondersteunt het al, maar een offline-queue in de PWA
   is substantieel extra werk en hoort dan nu in de planning.
