# Lokaal draaien op je eigen pc

Deze handleiding gaat ervan uit dat je nog niets geïnstalleerd hebt. Werkt op
Windows, macOS en Linux.

Reken op 20–30 minuten de eerste keer, vooral omdat Docker een aantal
onderdelen moet downloaden.

---

## Stap 1 — Installeer drie programma's

| Programma | Waarvoor | Waar |
|---|---|---|
| **Node.js 22 of hoger** | Draait de applicatie | [nodejs.org](https://nodejs.org) — kies de LTS-versie |
| **Docker Desktop** | Draait de database | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| **Git** | Haalt de code op | [git-scm.com](https://git-scm.com) |

**Start Docker Desktop na het installeren en laat het draaien.** Zonder Docker
start de database niet. Je herkent het aan het walvis-icoon in je taakbalk of
menubalk; dat moet "running" aangeven.

Controleer daarna in een terminal (Windows: PowerShell, macOS: Terminal):

```bash
node --version     # v22 of hoger
docker --version
git --version
```

## Stap 2 — Haal de code op

```bash
git clone https://github.com/robinheutinkk1/tagpoint-taxi-dispatch.git
cd tagpoint-taxi-dispatch
git checkout claude/tagpoint-taxi-dispatch-d69dpb
```

## Stap 3 — Installeer de pakketten

```bash
npm install
```

## Stap 4 — Start de database

```bash
npm run db:start
```

De eerste keer duurt dit een paar minuten: Docker downloadt PostgreSQL, de
inlogdienst en de rest van de Supabase-onderdelen.

Als het klaar is toont hij een blokje met sleutels. **Twee daarvan heb je
nodig.**

## Stap 5 — Zet de sleutels in een instellingenbestand

Maak een bestand `.env.local` in de projectmap:

```bash
cp .env.example .env.local
```

Open het en vul in wat stap 4 toonde:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<de "anon key" uit stap 4>
SUPABASE_SERVICE_ROLE_KEY=<de "service_role key" uit stap 4>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PLATFORM_HOST=localhost:3000
```

De laatste twee regels (`TAG_TOKEN_PEPPER` en `CRON_SECRET`) mag je voorlopig
leeg laten; die worden pas in fase 7 gebruikt.

## Stap 6 — Vul de database

```bash
npm run db:reset
```

Dit maakt alle tabellen aan en zet de demo-gegevens erin: twee vervoersbedrijven,
zeven cliënten, vier chauffeurs, drie voertuigen en een groepsrit.

## Stap 7 — Start de applicatie

```bash
npm run dev
```

Open **http://localhost:3000** in je browser.

---

## Inloggen

Alle demo-accounts gebruiken hetzelfde wachtwoord:

```
tagpoint-demo-2026
```

| E-mailadres | Rol | Wat je ziet |
|---|---|---|
| `admin@ontzorgd.test` | Eigenaar | Alles, inclusief gebruikersbeheer |
| `planner@ontzorgd.test` | Planner | Cliënten, chauffeurs, voertuigen, locaties |
| `dispatcher@ontzorgd.test` | Dispatcher | Meekijken en toewijzen, geen cliënten aanmaken |
| `chauffeur1@ontzorgd.test` | Chauffeur | Bijna niets — dat is de bedoeling |
| `admin@voorbeeldtaxi.test` | Eigenaar bij een **ander** bedrijf | Andere cliënten |

## Wat je zou moeten testen

**1. Klopt het menu per rol?**
Log in als planner en als dispatcher. De dispatcher heeft géén knop "Nieuwe
cliënt" — die mag dat niet. Klopt dat met hoe Taxi Ontzorgd werkt? Zeg het als
een rol te veel of te weinig kan; dat is nu goedkoop aan te passen.

**2. Zie je als chauffeur echt bijna niets?**
Log in als `chauffeur1@ontzorgd.test`. Je hoort geen cliëntenlijst te zien. Dat
voelt misschien te streng — maar het is precies wat je zelf in de opdracht
schreef.

**3. Scheiding tussen bedrijven.**
Log in als `admin@voorbeeldtaxi.test`. Je ziet Klaas Bakker en Marie Visser, en
niemand van Taxi Ontzorgd. Probeer eens een cliënt-URL van het andere bedrijf te
plakken — je krijgt "niet gevonden".

**4. Plan een terugkerende rit in.**
Ga naar Terugkerend → Nieuwe afspraak. Kies een cliënt, maandag t/m vrijdag,
08:00. Na opslaan staan de komende weken meteen in de planning. Klik daarna een
losse rit aan en verzet de tijd: die rit krijgt het label "afwijkend" en wordt
bij een volgende generatie niet meer overschreven.

**5. Bekijk de chauffeursapp op je telefoon.**
Log in als `chauffeur2@ontzorgd.test` en ga naar `/driver`. Je ziet de groepsrit
van 16:00 met vier cliënten. Open hem: bij dagbesteding De Es druk je één keer
op "ik ben aangekomen", en vink je daarna de vier cliënten los van elkaar af.

Wil je het op je telefoon proberen, start dan met `npm run dev -- -H 0.0.0.0` en
open het IP-adres van je pc op je telefoon (zelfde wifi). In Chrome of Safari
kun je hem daarna aan je beginscherm toevoegen.

**6. Maak een NFC-tag aan.**
Ga als planner naar NFC-tags → Tag aanmaken. Je krijgt eenmalig een link te
zien; die schrijf je naar een NFC-sticker of print je als QR-code. Koppel de tag
aan Jan Jansen.

Open die link daarna in een privévenster: je ziet alleen "log in om verder te
gaan", geen naam en geen bedrijf. Log in als `chauffeur1@ontzorgd.test` en open
hem opnieuw — dan checkt hij Jan in. Nog een keer openen zegt "al ingecheckt om
…", zonder tweede registratie.

**7. Bekijk het ouderportaal.**
Log in als `ouder@ontzorgd.test` en ga naar `/portaal`. Olga ziet alleen Jan —
niet Piet, die bij dezelfde organisatie hoort. Geef een rit door als afmelding;
log daarna in als planner en beoordeel hem via Verzoeken.

Probeer als ouder de URL van een andere cliënt te plakken: je krijgt "niet
gevonden".

**8. Zet je eigen huisstijl erop.**
Log in als `admin@ontzorgd.test` en ga naar Instellingen → Huisstijl. Verander de
primaire kleur en upload een logo (PNG, JPG of WebP, maximaal 512 kB). Het logo
verschijnt in de zijbalk, in de chauffeursapp en in het ouderportaal.

Probeer bewust een SVG te uploaden — dat wordt geweigerd. Hernoem die SVG naar
`.png` en probeer het nog eens: dat wordt óók geweigerd, want er wordt naar de
inhoud van het bestand gekeken en niet naar de naam.

**9. Voeg een eigen domeinnaam toe.**
Instellingen → Domeinnamen. Je krijgt een TXT-record te zien dat je bij je
domeinprovider moet zetten. Verifiëren lukt lokaal niet — er is geen echte
domeinnaam die naar je pc wijst — en dat is de verwachte uitkomst: "we vonden
nog geen TXT-record". In de seeddata staat wél een geverifieerd demodomein, zodat
je kunt zien hoe een geverifieerde rij eruitziet.

**10. Bekijk de rapportages.**
Log in als planner en ga naar Rapportages. De seeddata bevat 60 dagen historie,
dus u ziet meteen echte cijfers: hoeveel ritten zijn afgerond, hoe vaak iemand
niet thuis was, en hoe vaak er met een NFC-tag is ingecheckt in plaats van
handmatig afgevinkt. Die laatste is de belangrijkste: loopt hij terug, dan
worden de tags in de praktijk niet gebruikt.

Klik op "Exporteer CSV" en open het bestand in Excel. Let op de kolommen — als
er iets scheef staat, hoor ik het graag, want de scheiding tussen kolommen is
per land anders.

**11. Privacy: inzage en wissen.**
Open een cliënt en scrol naar de kaart Privacy. "Gegevens downloaden" geeft een
JSON-bestand met alles wat het systeem over die persoon bewaart — dat is het
antwoord op een inzageverzoek.

Probeer daarna "Persoonsgegevens wissen" bij een cliënt die u kwijt kunt. De
naam wordt "Verwijderd Cliënt", het adres en telefoonnummer verdwijnen, de
NFC-tag wordt losgekoppeld — en de ritten blijven staan. Dat laatste is met
opzet: dat is uw vervoersadministratie.

**12. Geef uzelf even support-toegang.**
Instellingen → Privacy en support. Verleen toegang aan de demo-platformbeheerder
voor twee uur en kijk wat er gebeurt: hij kan de ritten zien, maar met de kleine
scope niet de namen van cliënten. Trek hem daarna weer in. Alles wat u hier doet
komt in het logboek van uw organisatie.

**13. Wat mist er in de formulieren?**
Kijk bij een cliënt of je alle velden mist die Taxi Ontzorgd nodig heeft. Het
rolstoelveld ontbreekt met opzet (besluit D-03); alles wat je verder mist, hoor
ik graag.

---

## De demo-database bekijken

`npm run db:start` toont ook een **Studio URL** (meestal
http://127.0.0.1:54323). Daar kun je door de tabellen bladeren.

## Opnieuw beginnen

```bash
npm run db:reset      # database leegmaken en opnieuw vullen
```

## Stoppen

```bash
# in het venster waar npm run dev draait: Ctrl+C
npm run db:stop
```

---

## Als er iets misgaat

**"docker: command not found" of "Cannot connect to the Docker daemon"**
Docker Desktop draait niet. Start het en wacht tot het icoon "running" toont.

**`npm run db:start` blijft hangen of geeft een netwerkfout**
De eerste keer downloadt hij veel. Bij een echte fout: `npm run db:stop`,
Docker Desktop herstarten, opnieuw proberen.

**De pagina toont "Application error"**
Meestal ontbrekende sleutels in `.env.local`. Controleer of `NEXT_PUBLIC_SUPABASE_URL`
en `NEXT_PUBLIC_SUPABASE_ANON_KEY` gevuld zijn, en herstart `npm run dev` — dat
bestand wordt alleen bij het starten gelezen.

**Inloggen lukt niet**
Draai `npm run db:reset`. De demo-accounts worden dan opnieuw aangemaakt.

**Poort 3000 of 54321 is bezet**
Er draait al iets. Sluit dat af, of start met `npm run dev -- -p 3001`.

---

## Controleren of alles klopt

```bash
npm run verify         # code-controles, tests en een productiebuild
npm run test:security  # 128 tests: kan bedrijf A bij bedrijf B?
```

Beide horen groen te zijn. `test:security` heeft een draaiende database nodig.

## Wat lokaal niet werkt

Twee dingen uit Fase 10 kun je op je pc niet volledig proberen, en dat is geen
fout in de installatie:

- **Verificatie van een domeinnaam** vraagt een echte DNS-lookup. `localhost`
  heeft geen TXT-record, dus verificatie mislukt altijd — precies zoals bedoeld.
- **Logo-uploads** gaan naar Supabase Storage. Draai je de volledige
  Supabase-stack (`npm run db:start`), dan werkt dit gewoon. Draai je alleen de
  kale database (`npm run db:local`), dan is er geen opslagdienst en krijg je een
  foutmelding bij het uploaden. De regels die de scheiding tussen bedrijven
  bewaken zitten in de database en worden wél getest, met `npm run test:security`.

## Waarschuwing

De demo-gegevens zijn verzonnen en het wachtwoord staat in dit document. Gebruik
deze seed **nooit** op een omgeving met echte cliëntgegevens.
