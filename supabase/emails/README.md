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
