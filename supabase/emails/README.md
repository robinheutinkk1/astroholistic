# E-mailsjablonen

De mails die Supabase namens het platform verstuurt. Twee stuks, want dat is
alles wat deze applicatie gebruikt: een uitnodiging en een wachtwoordherstel.

| Bestand                 | Supabase                                  | Onderwerp                                   |
| ----------------------- | ----------------------------------------- | ------------------------------------------- |
| `invite-user.html`      | Authentication → Emails → **Invite user**    | `Je bent uitgenodigd voor TagPoint`         |
| `reset-password.html`   | Authentication → Emails → **Reset password** | `Nieuw wachtwoord instellen`                |

## Installeren

1. Open het bestand, selecteer alles, kopieer.
2. Supabase → Authentication → Emails → kies het sjabloon.
3. Plak over de bestaande inhoud heen en sla op.
4. Zet het onderwerp uit de tabel hierboven in het veld **Subject**.
5. Nodig jezelf uit op een tweede adres en kijk hoe hij aankomt.

## Het logo moet er eerst zijn

De mails verwijzen naar `https://taxi.tagpoint.nl/email-logo.png`. Dat bestand
hoort in `public/email-logo.png` in dit project; alles in `public/` is zonder
inloggen bereikbaar, en dat is precies wat een mailprogramma nodig heeft.

**Zolang dat bestand er niet staat, ziet de ontvanger een kapot plaatje.** Dat is
slechter dan de tekstregel die er eerst stond, dus dit is geen detail voor later.

Eisen aan het bestand:

- **PNG met transparante achtergrond.** De mail heeft een lichte achtergrond;
  een JPG krijgt daar een grijs blokje omheen.
- **264 bij 64 pixels**, dus twee keer de weergavemaat van 132x32. Schermen zijn
  tegenwoordig scherper dan de maat die in de HTML staat, en een logo op ware
  grootte oogt daarop wazig.
- **Donkere inkt.** De mail is licht van achtergrond en er is geen donkere versie:
  een wit logo wordt onzichtbaar.

Wijkt jouw logo af van 132x32 in verhouding, pas dan `width` en `height` in
allebei de sjablonen aan. Laat ze niet weg: zonder die attributen springt de
opmaak in Outlook uit elkaar terwijl het plaatje nog laadt.

## Waarom er geen uitgeschreven link meer onder de knop staat

Die stond er eerst, voor het geval een mailprogramma de knop wegknipt. Bewust
verwijderd omdat hij rommelig oogt.

Wat je daarmee opgeeft: bij een ontvanger wiens mailprogramma de knop niet
rendert, is er geen tweede weg naar binnen. Dat is bij zakelijke Outlook geen
theoretisch scenario. Gebeurt dat, dan is de terugweg de link hier weer
toevoegen.

## Niet aanpassen zonder te testen

`{{ .ConfirmationURL }}` is de eenmalige link. Zonder die exacte schrijfwijze
komt niemand binnen, en dat merk je pas als iemand belt dat het niet lukt.

## Waarom dit eruitziet als HTML uit 2005

Mailprogramma's zijn geen browsers. Outlook rendert met de engine van Word,
Gmail knipt `<style>` soms weg, en flexbox werkt in geen van beide betrouwbaar.
Tabellen en stijlen op het element zelf zijn hier niet ouderwets maar het enige
dat overal aankomt.

Wat er om die reden in zit:

- **een VML-knop voor Outlook.** Outlook negeert padding op een link en maakt er
  anders een kale tekstregel van, midden in de mail waar de knop hoort te staan.
- **de link ook uitgeschreven.** Bedrijfsmail knipt knoppen weg. Dan is die
  regel het enige dat overblijft.
- **een preheader.** De regel die in de inbox naast het onderwerp staat. Zonder
  die regel pakt de mailclient de eerste zichtbare tekst, en dat is bij de
  meeste mails de link zelf.
- **een scheidingslijn als tabelrij.** Een `<hr>` valt in Outlook uit elkaar.
- **expliciete kleuren op elke tekst.** Mailclients met een donkere modus
  draaien kleuren om die niet zijn opgegeven, en dan wordt grijze tekst op wit
  ineens wit op wit.

## De geldigheidsduur klopt met de instelling

De uitnodiging zegt 24 uur, het herstel een uur. Dat zijn de standaarden van
Supabase. Wijzig je die onder Authentication → Sessions of bij de OTP-instelling,
pas dan ook de tekst aan: een mail die iets anders belooft dan wat er gebeurt is
erger dan een mail die er niets over zegt.

## Wat deze mails NIET doen: meegaan met de huisstijl van een klant

De applicatie is white-label: elke vervoerder heeft een eigen logo en kleur. Deze
mails niet. Supabase verstuurt één sjabloon voor het hele project, en weet op dat
moment niet bij welke organisatie de ontvanger hoort.

Voor een chauffeur of ouder van Taxi Ontzorgd komt de uitnodiging dus binnen op
naam van TagPoint en niet van Taxi Ontzorgd. Dat is te verdedigen zolang TagPoint
zichtbaar de leverancier is, maar het wringt zodra een klant zijn eigen merk wil
voeren.

Het is oplosbaar, maar niet hier: dan moet de applicatie de uitnodigingsmail zelf
versturen via een eigen mailkoppeling, met de branding van de organisatie erbij,
in plaats van die aan Supabase over te laten. Dat is een op zichzelf staande klus.
Zie D-48 in `docs/RISKS_AND_DECISIONS.md`.
