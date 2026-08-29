# Deployment

Van een lege omgeving naar een draaiend productieplatform. Volg de stappen op
volgorde; elke stap noemt hoe je controleert dat hij gelukt is, want een deploy
die "waarschijnlijk goed ging" is geen deploy.

> **Wat hier niet in staat:** de keuze voor een hostingpartij zelf. Deze repo
> gaat sinds fase 1 uit van Vercel (`vercel.json`, de cronroute) en de
> instructies hieronder gaan daarover. Wat er verandert bij Cloudflare for SaaS
> staat in besluit D-23 en in §9 hieronder.

## Controleren of een migratie is aangekomen

`supabase/production/verify-migrations.sql` in de SQL Editor plakken en draaien.
Zeven regels, alles moet `OK` zijn. Staat er `MIST`, dan is die migratie niet
aangekomen en mag het migratiebestand gewoon opnieuw worden gedraaid — de
migraties zijn herhaalbaar.

De controle zoekt naar de vergelijking `organization_id = c.organization_id` en
niet naar een tabelnaam. Dat is met opzet: de eerste versie van deze query
zocht op het woord `contacts`, en dat staat óók in de oude, lekke policy (in
`contact_id` en in `'contacts.manage'`). Die versie meldde dus `OK` terwijl het
gat gewoon openstond. De query is daarna getoetst door de oude policies terug te
zetten en te controleren dat er wél `MIST` uit komt.


## 0. Wat je nodig hebt

| Nodig                | Waarvoor                                  |
| -------------------- | ----------------------------------------- |
| Supabase-organisatie | database, auth, storage                   |
| Vercel-account       | hosting, cron, certificaten voor domeinen |
| Toegang tot de DNS   | `tagpoint.nl` staat bij Strato (D-23)     |
| `openssl`            | secrets genereren                         |

## 1. Supabase-productieproject

Maak een **nieuw** project. Gebruik nooit hetzelfde project voor productie en
ontwikkeling: één `supabase db reset` op het verkeerde tabblad wist dan de
gegevens van echte cliënten.

- **Regio:** Frankfurt (`eu-central-1`). Persoonsgegevens van Nederlandse
  cliënten horen binnen de EU te blijven (AVG hoofdstuk V).
- **Databasewachtwoord:** genereer het, bewaar het in een wachtwoordmanager, en
  typ het nergens anders in.

Noteer uit **Project Settings → API**:

- de project-URL,
- de `anon` key (publiek by design — zie `docs/SECURITY.md` §7),
- de `service_role` key (**bypasst alle RLS**; alleen als serverse omgevingsvariabele).

## 2. Migraties draaien

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Dit voert `supabase/migrations/*.sql` op volgorde uit. Er is bewust geen
seedstap: `supabase/seed/` bevat demogegevens en die horen niet in productie.

**Zonder terminal.** `npm run sql:bundle` schrijft de 26 migraties naar vier
bestanden in `dist-sql/`, die je op volgorde in de SQL Editor van Supabase
plakt. De volgorde is heilig — deel 2 werkt niet zonder deel 1. Gaat er iets
mis, ga dan niet door: een half schema is lastiger te repareren dan opnieuw
beginnen met `drop schema public cascade; create schema public;`.

**Controle.** In de SQL editor:

```sql
-- Elke tabel in public moet RLS aan hebben. Dit hoort 0 rijen te geven.
select tablename from pg_tables where schemaname = 'public' and not rowsecurity;

-- En elke tabel hoort minstens één policy te hebben.
select t.tablename
from pg_tables t
left join pg_policies p on p.schemaname = 'public' and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename
having count(p.policyname) = 0;
```

Geeft de eerste query rijen terug, **stop dan**. Een tabel zonder RLS is een
tabel waar elke ingelogde gebruiker van elke organisatie in kan kijken.

## 2b. De eerste organisatie en de eerste beheerder

Na de migraties is de database **leeg**: geen gebruiker, geen organisatie. En er
is met opzet geen registratiepagina — `organizations` heeft geen INSERT-policy
voor tenants, want een organisatie wordt door het platform aangemaakt en niet
door zichzelf. Zonder deze stap heb je dus een werkende site waar niemand in kan.

1. **Supabase → Authentication → Users → Add user → Create new user.** Vul
   e-mailadres en wachtwoord in en vink **Auto Confirm User** aan; zonder dat
   vinkje kan er niet worden ingelogd.
2. Open `supabase/production/first-organization.sql`, vul bovenin de vier regels
   in (e-mailadres, naam, organisatienaam, slug) en draai hem in de SQL Editor.

Het script is veilig om twee keer te draaien en weigert netjes als het account
nog niet bestaat. Onderaan toont hij één regel ter controle: organisatie,
beheerder, rol `owner`, lidmaatschap `ACTIVE`.

Dezelfde stap herhaal je voor elke nieuwe klant die je aanneemt.

## 2c. Iets om te laten zien (optioneel)

Een verse installatie is leeg, en een leeg systeem valt niet te demonstreren:
elke lijst is leeg, het dashboard staat op nul, de rapportages tonen niets. Dat
ziet eruit alsof het product niet werkt terwijl er alleen nog geen gegevens in
staan.

`supabase/production/demo-organization.sql` vult één organisatie met verzonnen
maar realistisch vervoer: zes weken historie, ritten van vandaag in
verschillende stadia, terugkerende afspraken, een groepsrit met vier passagiers
en een ouder in het portaal. Vul bovenin je e-mailadres in en draai hem in de
SQL Editor.

Je eigen account wordt eigenaar van de demo-organisatie; met de
organisatiekiezer bovenin schakel je heen en weer. Er komen **geen extra
inlogaccounts** bij — demo-accounts met een bekend wachtwoord op een
productiesysteem zijn een risico dat een demo niet waard is.

Weghalen doe je met één regel, onderaan dat bestand.

## 3. Storage

Migratie 0021 maakt de bucket `organization-logos` aan met zijn policies. Wat je
zelf controleert in **Storage → Configuration**:

- de bucket bestaat en is **public**,
- de bestandslimiet is 512 kB,
- toegestane MIME-types: `image/png`, `image/jpeg`, `image/webp` — geen SVG
  (een SVG kan script bevatten; zie `docs/SECURITY.md` §10).

## 4. Auth

Het Authentication-menu van Supabase is lang. Hieronder staat per onderdeel wat
deze applicatie ervan nodig heeft, en waarom. Alles wat er niet in staat, laat
je met rust.

### 4a. URL Configuration — de belangrijkste

- **Site URL:** `https://taxi.tagpoint.nl` (het eigen domein, niet dat van de
  hostingpartij).
- **Redirect URLs:** `https://taxi.tagpoint.nl/auth/callback` én — voor elk
  klantdomein — `https://<klantdomein>/auth/callback`.

De applicatie stuurt uitnodigingen en wachtwoordherstel naar
`/auth/callback?next=…` (zie `src/features/auth/invite.ts` en
`src/features/auth/service.ts`). Staat die URL hier niet in de lijst, dan
weigert Supabase de doorverwijzing en komt de gebruiker op een foutpagina — het
account is dan wel aangemaakt, maar niemand kan erin.

> Dit is de stap die na een nieuw klantdomein wordt vergeten. Zonder de
> redirect-URL werkt inloggen op dat domein wel, maar strandt het herstellen van
> een wachtwoord. Zet hem erbij op het moment dat je het domein aanzet.

### 4b. Sign In / Providers — registratie uitzetten

- **Email** aan. Verder niets: geen social login, geen magic links (§3).
- **Allow new users to sign up: UIT.**
- Minimale wachtwoordlengte: **12**, gelijk aan `src/features/auth/schema.ts`.

Registratie uitzetten is geen nettigheid maar een beveiligingsmaatregel. De
applicatie heeft geen registratiepagina en roept nergens `signUp` aan: mensen
komen binnen via een uitnodiging. Maar de anon key staat in elke browser, en
zolang registratie aanstaat kan iedereen daarmee rechtstreeks bij de Supabase-API
een account aanmaken. Zo iemand ziet niets — hij heeft geen lidmaatschap, dus RLS
geeft hem nul rijen — maar hij vult wel `auth.users` en `profiles`, en dat is een
open deur voor rommel die je daarna met de hand moet opruimen.

De wachtwoordlengte op 12 zetten voorkomt het omgekeerde probleem: staat Supabase
hoger dan onze eigen regel, dan keurt ons formulier een wachtwoord goed dat
Supabase daarna weigert, met een foutmelding die de gebruiker niet kan plaatsen.

### 4c. Emails — vóór de eerste echte klant

De ingebouwde mail van Supabase is bedoeld om te testen en is hard begrensd
(enkele mails per uur). Bij de derde uitnodiging komt er niets meer aan, zonder
zichtbare fout. Stel een eigen SMTP-provider in (Resend, Postmark, SendGrid)
onder **Authentication → Emails → SMTP Settings**.

Pas daarna de sjablonen aan. Ze staan standaard in het Engels en met de naam van
het project erin; de ontvanger is een chauffeur of een ouder die van niets weet.

De vervangers staan klaar in **`supabase/emails/`**: `invite-user.html` en
`reset-password.html`, met een installatiehandleiding in dezelfde map. Kopieer
en plak ze over de standaardinhoud heen.

Laat `{{ .ConfirmationURL }}` staan zoals hij is: dat is de eenmalige link, en
zonder die exacte schrijfwijze komt niemand binnen.

### 4d. Attack Protection

- **Leaked password protection:** aan. Controleert tegen bekende gelekte
  wachtwoorden.
- **Captcha:** optioneel. Onze eigen limiet (`consume_rate_limit`, migratie
  0023) dekt het bruteforcen van inloggen en wachtwoordherstel al.

### 4e. Rate Limits

Laat de standaarden staan. Die van ons komen erbovenop, ze vervangen hem niet.
Verhoog hooguit het aantal e-mails per uur nadat eigen SMTP werkt.

### 4f. Sessions

De standaard voldoet. Zet een **Time-box user sessions** alleen als een klant
daarom vraagt; het betekent dat een planner midden op de dag opnieuw moet
inloggen.

`getUser()` valideert het token bij elke aanvraag opnieuw bij Supabase (zie
`src/proxy.ts`), dus een ingetrokken sessie werkt meteen niet meer — daar is geen
korte sessieduur voor nodig.

### 4g. Wat je met rust laat

**OAuth Apps**, **OAuth Server**, **Passkeys**, **Auth Hooks**, **Multi-Factor**
en **Audit Logs** hebben we niet nodig. Multi-Factor is de enige die later
interessant wordt, als een klant erom vraagt; de rest is voor heel andere
soorten applicaties.

## 5. Secrets genereren

```bash
openssl rand -base64 48   # TAG_TOKEN_PEPPER
openssl rand -base64 32   # CRON_SECRET
```

`TAG_TOKEN_PEPPER` is de gevaarlijkste van de twee om te verliezen: hij zit in
de hash van elk NFC-token. **Wijzig hem nooit na go-live** — elke uitgegeven tag
wordt er onherkenbaar door en die stickers zitten fysiek op spullen van
cliënten. Bewaar hem in een wachtwoordmanager, niet alleen bij de hostingpartij.

## 6. Vercel

Koppel de repository en zet in **Settings → Environment Variables** (scope
Production):

| Variabele                       | Waarde                                     |
| ------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | de project-URL uit stap 1                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | de anon key                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | de service-role key                        |
| `NEXT_PUBLIC_APP_URL`           | `https://app.tagpoint.nl`                  |
| `NEXT_PUBLIC_PLATFORM_HOST`     | `app.tagpoint.nl`                          |
| `TAG_TOKEN_PEPPER`              | uit stap 5                                 |
| `CRON_SECRET`                   | uit stap 5                                 |
| `HOSTING_API_TOKEN`             | optioneel, zie §9                          |

**Controle vóór de eerste deploy:**

```bash
npm run check:env:production
```

Draai dit met de productiewaarden in de shell. Het weigert onder andere een
service-role key in een `NEXT_PUBLIC_`-variabele — dat is de fout die de sleutel
die álle RLS omzeilt in de browserbundle zet, en runtimevalidatie ziet hem niet
omdat de waarde op zichzelf geldig is.

## 7. De cron

`vercel.json` zet de nachtelijke job op `0 2 * * *` (02:00 UTC). Vercel stuurt
automatisch `Authorization: Bearer $CRON_SECRET` mee zolang die variabele
bestaat; de route weigert alles zonder.

De job doet drie dingen: ritten genereren uit terugkerende afspraken,
bewaartermijnen toepassen, en de rate-limittabel opruimen.

**Controle**, met het echte secret:

```bash
curl -s -X POST https://app.tagpoint.nl/api/cron/nightly \
  -H "Authorization: Bearer $CRON_SECRET"
# {"organizations":N,"created":N,"failed":0,"anonymized":0,"rateLimitRowsRemoved":N}
```

En zonder header hoort er `401` te komen. Controleer dat ook: een open
cronendpoint is een schrijfactie die iedereen kan aanroepen.

## 8. Het platformdomein

`app.tagpoint.nl` als CNAME naar Vercel, bij Strato. De apex `tagpoint.nl` heeft
een A-record nodig naar het IP dat Vercel opgeeft — Strato ondersteunt geen
CNAME op de apex, zoals geen enkele provider dat mag.

**Ga na of Strato een wildcard (`*.tagpoint.nl`) ondersteunt** als je klanten
straks een subdomein van het platform wilt geven. De code houdt daar al rekening
mee (`checkHostname()` weigert een claim op een subdomein van de platformhost),
maar het uitdelen zelf is nog niet gebouwd.

## 9. Domeinen van klanten

De applicatiekant is af: een organisatie voegt een domeinnaam toe, publiceert
een TXT-record, klikt op verifiëren. Wat daarna moet gebeuren is het domein
aanmelden bij de hostingpartij zodat er een certificaat komt.

**Met `HOSTING_API_TOKEN` gezet** gebeurt dat automatisch na een geslaagde
verificatie. Maak het token met scope *Domains* op het project, niet op het
account. Een project-id hoef je op Vercel niet te zetten: die levert
`VERCEL_PROJECT_ID` zelf al aan.

> De naam begint met opzet niet met `VERCEL_`. Dat voorvoegsel is bij Vercel
> gereserveerd, en een eigen variabele met die naam wordt geweigerd met
> "Environment variable ... is invalid".

**Zonder die variabelen** blijft alles werken, maar krijgt de organisatie de
melding dat TagPoint het domein aanzet — en dan moet dat met de hand. Dat is
bewust zichtbaar gemaakt: een domein dat verifieert en daarna stilletjes niets
serveert is de slechtste van de drie uitkomsten.

**Kies je Cloudflare for SaaS**, dan moet `tagpoint.nl` als zone bij Cloudflare
staan en schrijf je een tweede implementatie van `DomainProvider` in
`src/features/domains/provider.ts`. De rest van de code verandert niet; daar is
die naad voor. Zie D-23.

## 10. Rookproef na de eerste deploy

Loop dit af, in deze volgorde. Stop bij de eerste die niet klopt.

1. `curl -sI https://app.tagpoint.nl/login` — status 200 en de headers
   `content-security-policy`, `strict-transport-security`, `x-frame-options`.
2. `curl -s https://app.tagpoint.nl/api/health` — `{"status":"ok","database":true}`.
3. Open `/login` in een browser met de console open: geen enkele CSP-melding.
   Dit is de controle die de end-to-end suite lokaal doet, nu achter de
   hostingpartij — die zijn eigen headers kan toevoegen.
4. Log in als de eerste beheerder en maak een organisatie aan.
5. Open `/t/TP0000000000000000000000` in een privévenster: "log in om verder te
   gaan", geen naam en geen organisatie.
6. Voeg een cliënt toe, plan een rit, en check hem in als chauffeur op een echte
   telefoon.
7. Vraag op de cliëntpagina een AVG-export op en controleer dat er staat wat je
   verwacht.

**Controleer ook of de `Host`-header aankomt.** Herschrijft er iets tussen de
bezoeker en de applicatie die header naar de origin-host, dan vindt
`branding_for_host()` niets en valt élke klant stil terug op platformstyling —
zonder foutmelding. Test het door een geverifieerd klantdomein te openen en te
kijken of het logo van die klant verschijnt.

## 11. Monitoring en alerting

Zet minimaal deze drie:

| Signaal                                     | Waarom                                                     |
| ------------------------------------------- | ---------------------------------------------------------- |
| `/api/health` geeft geen 200                | de database is onbereikbaar; de applicatie zelf leeft nog   |
| de nachtelijke job draaide niet, of gaf 5xx | zonder generatie staat er morgen niets in de planning       |
| foutpercentage op Server Actions            | een gefaalde afmelding komt bij niemand terecht             |

Twee dingen om in de logs op te zoeken, want ze falen bewust stil:

- `Rate limiter unavailable; allowing the request` — de limiter faalt open (D-29),
  dus het product werkt door zonder bescherming. Dat mag je niet pas bij een
  incident ontdekken.
- `Erasure left a login account behind` — een AVG-verwijdering is half gelukt.

De alert hoort naar een mens te gaan die er iets aan kan doen, niet naar een
kanaal dat niemand leest.

## 12. Back-up en herstel

Supabase maakt dagelijkse back-ups op de betaalde plannen; op Pro is er
point-in-time recovery. **Zet dat aan voordat er echte gegevens in staan.**

Wat je nog niet weet als je het niet geprobeerd hebt: hoe lang een herstel
duurt. Doe één keer een restore naar een apart project en klok het, zodat je bij
een incident een getal kunt noemen in plaats van een schouderophaal.

Ritten en events zijn onvervangbaar — dat is de vervoersadministratie. Logo's in
storage zijn dat niet.

## 13. Terugdraaien

Een deploy terugdraaien is één klik in Vercel (**Deployments → Promote to
Production** op de vorige).

Een migratie terugdraaien is dat niet. Migraties zijn forward-only (`DATABASE.md`
§11) en sommige zijn onomkeerbaar: 0021 heeft `logo_url` weggegooid, 0026
anonimiseert. Gaat er iets mis met een migratie, dan is de weg vooruit een
nieuwe migratie die het repareert — niet een restore, want die gooit alles weg
wat er sinds de deploy is gebeurd.

Dus: draai migraties nooit tegelijk met een risicovolle applicatiewijziging, en
lees `supabase db push --dry-run` voordat je hem echt draait.

## 14. Wat er nog niet is

Eerlijk, zodat niemand hierop rekent:

- **PWA-verificatie op echte toestellen.** De chauffeurs-app is
  responsive-getest, maar niet op een echte iPhone en Android met NFC. Doe dat
  vóór go-live: `navigator.nfc` gedraagt zich per platform anders en dat merk je
  alleen op het toestel.
- **Een penetratietest door een derde** (`docs/SECURITY_AUDIT.md`).
- **Een gemeten herstel.** Zie §12.
- **Belastingtest op productiehardware.** De volumetest (`npm run perf`) draait
  op één machine met een warme cache; dat zegt niets over gelijktijdigheid en
  connectiedruk (D-30).
