# E-mailsjablonen

De mails die Supabase namens het platform verstuurt. Twee stuks, want dat is
alles wat deze applicatie gebruikt: een uitnodiging en een wachtwoordherstel.

| Bestand                 | Supabase                                  | Onderwerp                                   |
| ----------------------- | ----------------------------------------- | ------------------------------------------- |
| `invite-user.html`      | Authentication → Emails → **Invite user**    | `Je bent uitgenodigd voor Tagpoint`         |
| `reset-password.html`   | Authentication → Emails → **Reset password** | `Nieuw wachtwoord instellen`                |

## Installeren

1. Open het bestand, selecteer alles, kopieer.
2. Supabase → Authentication → Emails → kies het sjabloon.
3. Plak over de bestaande inhoud heen en sla op.
4. Zet het onderwerp uit de tabel hierboven in het veld **Subject**.
5. Nodig jezelf uit op een tweede adres en kijk hoe hij aankomt.

## Het logo: beeldmerk als plaatje, woordmerk als tekst

Boven in de mail staat het beeldmerk (`public/email-mark.png`, de drie staven)
met het woord Tagpoint ernaast als gewone tekst.

Dat is geen halve oplossing maar de betere voor e-mail:

- **Outlook blokkeert plaatjes standaard.** Staat de naam als tekst, dan is hij
  er nog steeds. Was het één plaatje geweest, dan zag de ontvanger een leeg vak.
- **Tekst blijft scherp** op elk scherm, ongeacht de pixeldichtheid.
- **Voorlezen werkt.**

Het beeldmerk wordt getekend door `scripts/make-email-mark.mjs`: drie
rechthoeken met ronde hoeken, oplopend in hoogte, in de kleuren van het merk.
Kloppen de kleuren niet precies, pas ze daar aan en draai het script opnieuw.

Het woordmerk is bewust géén plaatje. De letter uit het echte logo is een
geometrische schreefloze die in de mail niet beschikbaar is; namaken met een
andere letter levert een logo op dat er nét naast zit, en dat valt bij een merk
meer op dan wanneer je het niet probeert.

Wil je later tóch het volledige logo als plaatje: lever een PNG van 264 bij 64
pixels met transparante achtergrond en donkere inkt aan, en vervang in beide
sjablonen de tabel met de twee cellen door één `<img>`. Zet de naam dan wel in
de `alt`, anders is er bij geblokkeerde plaatjes niets meer te zien.

## De uitgeschreven link onder de knop

Die staat er bewust, voor het geval een mailprogramma de knop wegknipt. Bij
zakelijke Outlook is dat geen theoretisch scenario, en dan is die regel de enige
weg naar binnen.

`{{ .ConfirmationURL }}` staat daarom twee keer in het sjabloon: een keer als
bestemming van de link en een keer als zichtbare tekst. Het is geen vaste link
maar een plaatshouder die Supabase bij het versturen invult, voor elke ontvanger
met zijn eigen eenmalige adres.

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
naam van Tagpoint en niet van Taxi Ontzorgd. Dat is te verdedigen zolang Tagpoint
zichtbaar de leverancier is, maar het wringt zodra een klant zijn eigen merk wil
voeren.

Het is oplosbaar, maar niet hier: dan moet de applicatie de uitnodigingsmail zelf
versturen via een eigen mailkoppeling, met de branding van de organisatie erbij,
in plaats van die aan Supabase over te laten. Dat is een op zichzelf staande klus.
Zie D-48 in `docs/RISKS_AND_DECISIONS.md`.
