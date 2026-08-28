# Beslispunten, aannames en risico's

> Het masterprompt (§70) vraagt expliciet: *"Als je merkt dat een beslissing
> grote gevolgen heeft voor schaalbaarheid, security, GDPR, multi-tenancy of
> toekomstige SaaS-functionaliteit, STOP dan en benoem het."*
>
> Dit document is dat moment. **D-02 en D-03 vragen een besluit vóór Fase 2**;
> de rest is genomen met de genoemde onderbouwing en kan worden teruggedraaid
> als je het er niet mee eens bent.

---

## Vraagt jouw besluit vóór Fase 2

### D-02 — Platformbeheerders krijgen géén toegang tot cliëntgegevens
**Impact: security, GDPR, supportproces**

Ik heb ervoor gekozen dat een TagPoint-platformbeheerder via RLS **geen** rijen
uit `clients`, `contacts`, `rides` of `ride_events` kan lezen. Alleen
organisatiemetadata, abonnementen en aantallen.

*Waarom:* jij bent verwerker, je klanten zijn verwerkingsverantwoordelijke. Als
één platformaccount alle tenants kan uitlezen, is dat account het enige wat
tussen een phishingmail en de persoonsgegevens van duizenden kwetsbare mensen
staat. Dat is een risico dat je als leverancier niet hoort te dragen en dat je
klanten in een verwerkersovereenkomst uitgesloten willen zien.

*Wat het kost:* je kunt een supportvraag als "die rit staat verkeerd" niet zelf
in de data bekijken. Je ziet dat er een probleem is, maar niet welke cliënt het
betreft.

*Het alternatief dat ik voorstel:* `support_access_grants` — de organisatie
verleent zelf tijdelijke inzage (bijv. 4 uur, met reden), automatisch
verlopend, volledig geaudit, zichtbaar voor de klant. Dat is in Fase 12 gepland.

**Keuze aan jou:**
- **(a)** Zoals voorgesteld: geen toegang, `support_access_grants` in Fase 12.
- **(b)** Idem, maar `support_access_grants` naar voren halen (Fase 4).
- **(c)** Platformbeheerders krijgen wél leesrechten op tenantdata. Dan wil ik
  dat schriftelijk vastleggen inclusief de gevolgen voor je
  verwerkersovereenkomst, want dit is niet meer terug te draaien zodra klanten
  erop rekenen.

---

### D-03 — Vervoersbehoeften en het AVG artikel 9-vraagstuk
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

*Het risico:* "gebruikt een rolstoel" is juridisch waarschijnlijk een gegeven
over gezondheid (AVG art. 9). Verwerking is verdedigbaar — zonder die informatie
kun je de dienst niet leveren — maar het vraagt een grondslag in de
verwerkersovereenkomst en strengere beveiliging dan gewone gegevens.
`transport_notes` is bovendien een vrij tekstveld, en dat betekent dat er vroeg
of laat "heeft epilepsie" in komt te staan. Dat is geen ontwerpfout maar een
voorspelbare gebruikersgewoonte, en het maakt van je platform ongewild een
gedeeltelijk zorgdossier.

*Mijn mitigatie:* apart recht `clients.transport_notes.view`, zichtbare
waarschuwing in de UI ("geen medische informatie invullen"), maximaal 500
tekens, wijzigingen in de auditlog, en het veld verplicht meenemen in het
erasurepad.

**Keuze aan jou:**
- **(a)** Zoals voorgesteld: enum + `transport_notes` met de mitigaties.
- **(b)** Alleen de enum, geen vrij tekstveld. Veiligste optie, maar planners
  zullen de informatie ergens anders kwijt willen — waarschijnlijk in
  `rides.notes`, en dan heb je hetzelfde probleem op een slechtere plek.
- **(c)** Ook de enum weglaten en rolstoelvervoer per rit vastleggen in plaats
  van per cliënt. Minst gegevens over de persoon, maar planners moeten het bij
  elke rit opnieuw invoeren.

Ik adviseer **(a)**, en aanraden om dit met je jurist/DPO te toetsen vóór de
eerste echte klantdata het systeem in gaat.

---

## Genomen besluiten (terug te draaien, met onderbouwing)

### D-01 — Repositorynaam
De repo heet `astroholistic`, het product `TagPoint Taxi Dispatch`. Er staat
geen `astroholistic`-code in. Advies: hernoemen vóór er externe developers of
klanten meekijken. Puur cosmetisch, blokkeert niets.

### D-04 — Geen organisatie-claim in het JWT
Organisatielidmaatschap wordt in RLS per query uit de database gelezen, niet uit
een JWT-claim.

*Waarom:* een JWT blijft tot een uur geldig. Met een claim houdt iemand die net
uit een organisatie is verwijderd nog een uur toegang tot cliëntgegevens. Bij
een ontslagen medewerker is dat precies het verkeerde uur.

*Wat het kost:* een extra indexlookup per query. Die kosten worden geneutraliseerd
door de `(select app.fn())`-conventie, waardoor Postgres de functie één keer per
statement uitvoert in plaats van één keer per rij (zie `SECURITY.md` §4). Bij
gemeten problemen is een claim later alsnog toe te voegen, met een korte TTL en
een expliciet intrekmechanisme.

### D-05 — Geen aparte `qr_codes`-tabel
§39 noemt `qr_codes` als tabel, §21 eist dat NFC en QR niet twee systemen
worden. Ik volg §21: één tag, één token, één statusmodel; QR is een weergave.

*Waarom:* met twee tabellen ontstaat de toestand "tag ingetrokken als NFC, nog
geldig als QR". Dat is een beveiligingsfout die je er dan zelf in bouwt.

### D-06 — Ritten worden gematerialiseerd, niet virtueel berekend
Terugkerende ritten genereren echte `rides`-rijen in een rollend venster van 60
dagen.

*Waarom:* een rit draagt een chauffeur, voertuig, status, events en
uitzonderingen. Dat kan niet op een virtuele rij. Duplicaatpreventie zit op
databaseniveau (partiële unique index), niet in applicatielogica — twee
gelijktijdige jobs mogen niet allebei slagen.

*Gevolg dat je moet weten:* een wijziging aan een template werkt **niet**
terugwerkend door in al gegenereerde ritten die handmatig zijn aangepast of die
`SCHEDULED` verlaten hebben. Dat is bewust (§15), maar het is wel gedrag dat
planners moet worden uitgelegd. De UI toont daarom bij het wijzigen van een
template expliciet hoeveel toekomstige ritten worden geraakt.

### D-07 — Lokale wandkloktijd is gezaghebbend
`ride_templates.departure_time` is een lokale tijd, niet een UTC-timestamp.

*Waarom:* "elke werkdag om 08:00" betekent 08:00 op de klok, ook na de
zomertijdovergang. Sla je dat als UTC op, dan vertrekt de bus eind maart een uur
verkeerd. `rides` bewaart zowel de lokale tijd (gezaghebbend) als een afgeleide
`timestamptz` (om te sorteren en filteren).

### D-08 — Portalen schrijven nooit rechtstreeks in `rides`
Cliënten, ouders en opdrachtgevers maken een `change_request`; een planner
beoordeelt. Afmelden kan direct doorwerken als de organisatie dat aanzet, maar
ook dan blijft het verzoek als herkomst bewaard.

*Waarom:* §32 eist het, en het voorkomt dat een ouder om 05:00 een rit annuleert
waar de planning al op gebouwd is, zonder spoor van wie dat deed.

### D-09 — Check-out is een event, geen status
De statuslijst blijft exact zoals §17 hem voorschrijft. Check-out wordt als
`CLIENT_CHECKED_OUT`-event vastgelegd en `ARRIVED → COMPLETED` wordt geblokkeerd
als de organisatie check-out verplicht heeft. Zo kan check-out per organisatie
uit, optioneel of verplicht zijn zonder dat de state machine verandert.

### D-10 — Realtime nu met `postgres_changes`, ontworpen voor broadcast
Alleen op dispatch en dashboard, achter één hook (`useRideStream`).

*Schaalwaarschuwing:* `postgres_changes` evalueert RLS per abonnee per wijziging.
Bij honderden organisaties met meerdere dispatchers is dit het eerste knelpunt
dat je zult raken. De overstap naar Realtime Broadcast met een kanaal per
organisatie is bewust beperkt tot één bestand. We bouwen het nu niet — we maken
het goedkoop.

### D-11 — Chauffeurs krijgen geen `clients.view`
Een chauffeur ziet cliëntgegevens alleen in de context van een aan hem
toegewezen rit, binnen een venster van gisteren tot 7 dagen vooruit.

*Waarom:* §4 eist het letterlijk. Het venster is een toevoeging van mij: een
chauffeur die vorig jaar één rit reed, hoort niet permanent het adres van die
cliënt te kunnen opvragen.

*Wat het kost:* een chauffeur kan niet vooruit plannen buiten 7 dagen en kan een
cliënt niet opzoeken. Zeg het als dat operationeel knelt — het venster is een
instelling, geen aanname.

### D-12 — Verwijderen van personen gaat via anonimisering
Geen `ON DELETE CASCADE` op personen. Het GDPR-erasurepad wist de
persoonsvelden en laat ritten en events staan.

*Waarom:* cascade-verwijderen van een cliënt zou duizenden ride-events wissen —
je vervoersadministratie én je audit trail. Anonimiseren voldoet aan het recht
op vergetelheid zonder de administratie te vernietigen. Wel te bevestigen met
je jurist: of anonimisering in jouw geval volstaat, hangt af van de
bewaarplichten die op je klanten rusten.

### D-13 — Documenten in `docs/`
§65 noemt de documenten zonder pad. Ik heb ze in `docs/` gezet en verwijs vanuit
`README.md`. Bij acht documenten wordt de root anders onleesbaar. Makkelijk te
verplaatsen als je ze liever in de root hebt.

---

## Aannames

| # | Aanname | Als dit niet klopt |
|---|---|---|
| A-01 | Nederlandse markt, Europe/Amsterdam, `nl-NL` als default; i18n voorbereid maar niet gebouwd | Meertaligheid is dan Fase 4-werk, geen nabouw |
| A-02 | Één Supabase-project voor alle tenants (shared schema) | Bij een klant die een eigen database eist, wordt dat een aparte deployment |
| A-03 | Chauffeurs hebben een smartphone met browser; geen native app | Web NFC blijft progressive enhancement |
| A-04 | Cliënten zijn niet altijd digitaal vaardig; het cliëntportaal is lichtgewicht en optioneel | Meer investering in dat portaal nodig |
| A-05 | Ritvolume per organisatie: tientallen tot enkele honderden per dag | Bij duizenden per dag komt partitionering van `ride_events` eerder in beeld |
| A-06 | Geen koppeling met bestaande planningssoftware in V1 | Een import-/API-laag wordt dan Fase 11-werk |
| A-07 | ~~Er is nog geen Supabase-project aangemaakt~~ — **bevestigd 2026-08-28**: er bestaat er geen | Niet meer van toepassing; zie "Infrastructuur" hieronder |

## Infrastructuur — stand van zaken (bevestigd 2026-08-28)

| Onderdeel | Status | Wanneer nodig |
|---|---|---|
| GitHub-repository | **Bestaat**: `robinheutinkk1/astroholistic`, branch `claude/tagpoint-taxi-dispatch-d69dpb` | Nu in gebruik |
| Supabase-project (cloud) | Bestaat niet | Pas aan het eind van Fase 2 |
| Vercel-project | Bestaat niet | Fase 14 (of eerder voor previews) |
| Domein `tagpoint.nl` | Onbekend | Fase 10 |

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
