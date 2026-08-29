# Tagpoint — NFC en QR

> Status: **ontwerp (Fase 0/1)**. Implementatie in Fase 7.

---

## 1. Eén systeem, twee dragers

NFC en QR zijn **niet** twee functies. Er is één entiteit — een Tagpoint-tag —
met één identifier, één statusmodel, één intrekpad en één check-in flow. NFC en
QR zijn twee manieren om diezelfde identifier aan te bieden (§21).

Daarom is er **geen aparte `qr_codes`-tabel**, ondanks dat §39 die noemt. Twee
tabellen zouden twee waarheden betekenen: een tag die als NFC is ingetrokken
maar via QR nog werkt, is precies het soort beveiligingsfout dat je hiermee
inbouwt. De QR-code is een gerenderd plaatje van de tag-URL. Zie
`RISKS_AND_DECISIONS.md` D-05.

## 2. Identifiers

Elke tag heeft er twee, met verschillende doelen:

|              | `public_code`                       | `token`                         |
| ------------ | ----------------------------------- | ------------------------------- |
| Voorbeeld    | `TP-TAXI-8F3A21`                    | `k7q2mx4f9b3n8v6c1s5r0t`        |
| Doel         | Mensen: opdruk, inventaris, support | Machines: de URL                |
| Entropie     | Laag (leesbaar)                     | 128 bit random                  |
| In de URL?   | **Nee**                             | Ja                              |
| Opslag in DB | Platte tekst                        | Alleen `sha256(token ‖ pepper)` |

De URL is `https://<host>/t/<token>`.

Dit onderscheid is het punt. Een leesbare code in de URL is enumereerbaar: wie
`TP-TAXI-8F3A21` ziet, probeert `8F3A22`. Met een 128-bit token is raden
zinloos. En omdat de database alleen de hash bewaart, levert een databaselek
geen werkende tag-URL's op.

De pepper (`TAG_TOKEN_PEPPER`) staat buiten de database, zodat een dump zonder
serverconfiguratie ook niet met een woordenlijst te bruteforcen is.

## 3. Statusmodel

```
UNASSIGNED ──koppelen──→ ACTIVE ──ontkoppelen──→ UNASSIGNED
     │                     │  │
     │                     │  └──deactiveren──→ INACTIVE ──→ ACTIVE
     │                     │
     └─────────────────────┴──als verloren melden──→ LOST
                           │
                           └──vervangen──→ REPLACED  (replaced_by_tag_id)
```

- `UNASSIGNED` — bestaat, nog niet aan een cliënt gekoppeld
- `ACTIVE` — gekoppeld en bruikbaar voor check-in
- `INACTIVE` — tijdelijk uitgeschakeld
- `LOST` — kwijt; scannen wordt geweigerd én gelogd (een scan op een verloren
  tag is een signaal, geen fout)
- `REPLACED` — vervangen door een nieuwe tag; verwijst naar de opvolger

Alleen `ACTIVE` staat check-in toe. Eén actieve tag per cliënt, afgedwongen met
`unique (client_id) where status = 'ACTIVE'`.

Elke koppeling en ontkoppeling schrijft een rij in `tag_assignments` en een
regel in de auditlog. De vraag "wie hing wanneer welke tag aan wie" moet
beantwoordbaar zijn.

## 4. Wat een scan wél en niet is

**Een scan is een identificatie van een tag, geen autorisatie van een persoon.**

Wie de tag scant, wordt bepaald door het sessie-JWT. Wie de tag identificeert,
door het token. Die twee worden nooit door elkaar gehaald: een gevonden tag in
de bus geeft de vinder niets.

## 5. De publieke landingspagina `/t/[token]`

Deze route is bereikbaar zonder inloggen — dat moet wel, want een NFC-tap opent
gewoon een browser. Daarom geldt hier de strengste regel van het hele platform:

> **De pagina toont onder geen enkele omstandigheid persoonsgegevens aan een
> niet-geauthenticeerde bezoeker.**

Niet de naam van de cliënt, niet het adres, niet de organisatie, en ook niet of
het token überhaupt bestaat. Een onbekend token en een geldig token van een
andere organisatie geven exact dezelfde pagina — anders is de route een orakel
waarmee je geldige tags kunt vinden.

Een niet-ingelogde bezoeker ziet: het Tagpoint- (of white-label-) logo, de tekst
"Deze tag hoort bij een vervoersorganisatie. Log in om verder te gaan", en een
loginknop. Meer niet.

Op de achterkant van de fysieke tag hoort daarom ook geen naam te staan — alleen
het `public_code` en een neutrale terugstuurinstructie.

## 6. Check-in flow

```
1.  Chauffeur tapt de tag (of scant de QR)
2.  Browser opent /t/<token>
3.  Niet ingelogd → neutrale pagina + login, daarna terug naar deze URL
4.  Server: hash het token, zoek de tag
5.  Tag onbekend / niet ACTIVE / geen cliënt        → neutrale melding
6.  Bepaal organisatie en gekoppelde cliënt uit de tag
7.  Is de gebruiker chauffeur in díe organisatie?    → nee: "Geen toegang."
8.  Zoek de actieve rit: deze cliënt, vandaag,
    toegewezen aan deze chauffeur, in een check-in-
    bare status, binnen het tijdvenster
9.  Geen rit gevonden                                → "Geen actieve rit gevonden."
10. Al ingecheckt                                    → "Jan is al ingecheckt om 08:27."
11. Statusovergang toegestaan?                       → nee: nette uitleg
12. Schrijf ride_event CLIENT_CHECKED_IN (source=NFC|QR, GPS indien toegestaan)
13. Werk rides.status en rides.checked_in_at bij
14. Bevestig: "Jan Jansen succesvol ingecheckt om 08:27."
```

Stappen 12 en 13 gebeuren in **één transactie** via een `security definer` RPC.
Anders bestaat de toestand "event geschreven, status niet bijgewerkt" — en dan
klopt de audit trail niet meer met de werkelijkheid.

Pas vanaf stap 12 verschijnt er een naam op het scherm. Alles daarvoor is
neutraal.

### Ritselectie

Kandidaten zijn ritten van vandaag (in de tijdzone van de organisatie), voor
deze cliënt, toegewezen aan deze chauffeur, met status `DRIVER_ARRIVED` of
`DRIVER_EN_ROUTE`. Bij meerdere kandidaten (heen- en terugrit op één dag) wint
de rit met de dichtstbijzijnde `scheduled_pickup_at`. Blijft het ambigu, dan
kiest de chauffeur uit een lijst van twee knoppen — raden is hier erger dan één
extra tik.

## 7. Idempotentie en dubbele scans (§60)

Een NFC-tag wordt in de praktijk twee of drie keer getapt: de eerste tap gaf
geen zichtbare reactie, dus de chauffeur probeert opnieuw.

Twee lagen:

1. **Database.** Partiële unique index op
   `(ride_id, event_type)` voor `CLIENT_CHECKED_IN`, `CLIENT_CHECKED_OUT`,
   `TRIP_STARTED`, `ARRIVED`, `COMPLETED`. Een tweede insert kan niet slagen,
   ook niet bij twee gelijktijdige requests.
2. **Service.** Vangt de unique violation en geeft een **succes**-achtig
   antwoord terug: "Jan Jansen is al ingecheckt om 08:27." Geen foutmelding —
   de chauffeur heeft niets fout gedaan en de gewenste eindtoestand is bereikt.

De operatie is daarmee idempotent: één keer of vijf keer scannen levert dezelfde
toestand en dezelfde audit trail op.

## 8. Handmatige terugval

NFC werkt niet altijd: oudere Android-toestellen, een defecte tag, iOS met NFC
uit. Daarom kan een chauffeur in de PWA altijd:

- de QR-code scannen (camera), of
- de rit openen en op "Cliënt inchecken" tikken.

Die handmatige route schrijft hetzelfde event met `source = 'MANUAL'`. De
autorisatie is identiek — een handmatige check-in is geen achterdeur, alleen een
andere drager. In rapportages is `source` zichtbaar, zodat een organisatie kan
zien hoe vaak de tag daadwerkelijk werd gebruikt.

## 9. Platformverschillen

| Platform         | Gedrag                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| iOS 14+          | Achtergrond-NFC-lezen: tag tappen opent de URL zonder app. Werkt.                                                           |
| Android (Chrome) | Idem via het besturingssysteem; daarnaast is Web NFC beschikbaar voor in-app scannen                                        |
| Web NFC API      | Alleen Chrome/Android. Wordt als _progressive enhancement_ gebruikt: scannen zonder de app te verlaten. Nooit als vereiste. |
| Geen NFC         | QR via de camera, of handmatig                                                                                              |

De PWA gaat er nooit van uit dat Web NFC bestaat. De URL-flow is het
gegarandeerde pad; Web NFC maakt het alleen prettiger waar het beschikbaar is.

## 10. Tags aanmaken

Een organisatie met `tags.manage` klikt "Nieuwe NFC-tag". De server:

1. genereert 16 random bytes met een cryptografische generator → `token`
2. berekent `sha256(token ‖ pepper)` → `token_hash`
3. genereert een leesbaar `public_code` (`TP-` + orgprefix + 6 tekens uit een
   alfabet zonder `0/O` en `1/I/L`, uniek per organisatie)
4. slaat de tag op met `status = 'UNASSIGNED'`
5. toont het token **één keer**: als schrijfbare NFC-payload en als QR-code om
   te printen

Het token wordt daarna nooit meer getoond — het staat immers alleen gehasht in
de database. Een tag waarvan het token kwijt is, wordt vervangen (`REPLACED`),
niet hersteld. Dat is dezelfde afweging als bij API-keys, en om dezelfde reden.

Bulk aanmaken (bijvoorbeeld 50 tags voor een nieuwe klant) levert één
downloadbaar PDF-vel met QR-codes en `public_code`s op — **zonder namen**, want
op dat moment zijn de tags nog niet gekoppeld en horen ze dat ook niet te zijn.
