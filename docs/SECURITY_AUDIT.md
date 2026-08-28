# Beveiligingsaudit — Fase 12

Datum: 2026-08-28. Uitgevoerd tegen `docs/SECURITY.md` §2, dreiging voor
dreiging. Per regel staat waar de maatregel zit en waar het bewijs staat, zodat
dit document controleerbaar is en niet alleen geruststellend.

"Bewijs" betekent een test die faalt als de maatregel verdwijnt. Waar dat er
niet is, staat dat er.

## Bevindingen

Vier dingen zijn tijdens deze audit gevonden en gerepareerd. Ze staan bovenaan
omdat ze het interessantste deel zijn.

### B-01 — Chauffeur kon een volledig cliëntdossier exporteren

`export_client_data()` was `security invoker` en vertrouwde op RLS. Een
chauffeur mag de cliënt van zijn eigen rit lezen (D-11), dus de guard in de
functie liet hem door — en gaf het hele dossier terug: contactpersonen,
opdrachtgevers, alle ritten ooit, wijzigingsverzoeken, tags.

Mogen zien wie je ophaalt is niet hetzelfde als het dossier mogen downloaden.
Opgelost met een expliciete `clients.view`-controle in de functie. Gevonden door
S47, die bij de eerste run faalde.

_Les:_ RLS is de tenantgrens, maar hij is geen antwoord op "hoeveel mag deze rol
in één keer meenemen". Aggregatie- en exportfuncties hebben een eigen
permissiecontrole nodig.

### B-02 — Oneindige recursie tussen twee policies

`care_organizations_select` testte lidmaatschap met een `exists` over
`care_organization_users`; die policy testte het omgekeerde met een `exists`
over `care_organizations`. PostgreSQL weigerde de query:

```
ERROR: infinite recursion detected in policy for relation "care_organizations"
```

Niemand merkte het, omdat de eerste tak van de policy kortsluit voor een planner
mét het recht. Alleen een gebruiker *zonder* dat recht kwam bij de `exists` —
dus precies de zorgcoördinator voor wie die tak geschreven was. Hun portaal
haalde de data via `app.care_org_client_ids()`, dat `security definer` is en de
policy dus nooit evalueerde. Het defect zat tussen de twee paden in, waar niets
keek.

Opgelost in migratie 0025 met `app.care_org_ids()`. Regressietest: S53.

### B-03 — Nieuwe tabellen kregen geen grants

Migratie 0010 doet `grant ... on all tables in schema public to authenticated`.
Dat is een momentopname. `retention_policies` werd daarna aangemaakt en had dus
geen enkel recht voor `authenticated`: RLS kwam niet eens in beeld, de rol had
om te beginnen geen privilege. Het instellingenscherm zou voor elke tenant
gefaald hebben.

Opgelost met een expliciete grant. Gevonden door S52.

### B-04 — De CSP bestond alleen in een comment

`next.config.ts` beschreef een Content-Security-Policy in zijn documentatie en
zette hem niet. Er was geen CSP-header.

Opgelost: de policy wordt per request in `src/proxy.ts` gezet, met een nonce, en
staat in `src/lib/security/csp.ts` zodat hij testbaar is. Runtime geverifieerd —
de nonce in de header komt overeen met die op het script dat Next injecteert.

### Bijna-bevinding: een policy die ik zelf sloopte

Migratie 0024 moest `vehicles_select` droppen en opnieuw aanmaken om er één
regel aan toe te voegen. De eerste versie van die herschrijving verloor de
clausule waarmee een chauffeur het voertuig van zijn eigen rit ziet. **Geen
enkele test ving dat op.** Nu wel: S46.

Dat is de reden dat drop-and-recreate van een policy in dit project een
comment verdient waarin staat welke clausules zijn overgenomen.

## Dreiging voor dreiging

| #   | Maatregel zit in                                                    | Bewijs                          |
| --- | ------------------------------------------------------------------- | ------------------------------- |
| T1  | RLS op elke tenanttabel                                             | S01–S12, coveragetest           |
| T2  | RLS, niet de frontend; suite draait als `authenticated` via PostgREST-emulatie | hele securitysuite    |
| T3  | `app.driver_visible_client_ids()` met venster                       | S03, S46                        |
| T4  | `app.contact_client_ids()`                                          | S04, portaaltests               |
| T5  | `app.care_org_client_ids()` met geldigheidsperiode                  | S05                             |
| T6  | Trigger op rolwissel                                                | S13                             |
| T7  | Trigger op rol/organisatie                                          | S14                             |
| T8  | `/t/[token]` doet geen query voor anonieme bezoekers                | tag-checkin tests               |
| T9  | 128-bit token, gehasht opgeslagen                                   | `token.test.ts`, S20            |
| T10 | Append-only op drie lagen                                           | S15, S16, S38                   |
| T11 | `server-only` + ESLint-verbod op `lib/supabase/admin`               | ESLint-regel, handmatig geprobeerd |
| T12 | uuid-pk's, gelijke melding bij niet-gevonden en niet-toegestaan     | `app-error.ts`, S12             |
| T13 | Platformbeheer zonder tenantrechten                                 | S17, S33, S39                   |
| T14 | Host bepaalt alleen branding, alleen geverifieerde domeinen         | S29, S30                        |
| T15 | `consume_rate_limit()` per adres en per account                     | S54–S57                         |
| T16 | Kleur- en logovalidatie op drie lagen                               | S23, S24, `image.test.ts`       |
| T17 | `logo_path` met exacte CHECK-constraint                             | S24                             |
| T18 | Uniciteit pas bij `VERIFIED`, trigger op zelfverificatie            | S27, S28                        |
| T19 | Rapportagefuncties `security invoker` + permissiecontrole           | S31, S32                        |
| T20 | Formule-neutralisatie in de CSV-encoder                             | `csv.test.ts`                   |
| T21 | `report.exported` in de audit trail                                 | S37, S38                        |
| T22 | Expliciete `clients.view` in de exportfunctie                       | S47                             |
| T23 | Tijdgebonden, alleen-lezen, door de tenant verleende grants         | S39–S45                         |
| T24 | Anonimiseren in plaats van verwijderen                              | S49                             |
| T25 | Coveragetest op RLS en grants                                       | `rls-coverage.test.ts`, S52     |
| T26 | Rate limiting in de database                                        | S54–S57, vijf mutatietests      |

## Wat nog niet af is

Eerlijk over de gaten, want een audit die alleen groene vinkjes oplevert is geen
audit.

**~~Rate limiting heeft geen geautomatiseerde test.~~ Opgelost in Fase 13.**
Die conclusie was te somber: de logica zit in `consume_rate_limit()`, dat is SQL,
en de suite praat al met PostgreSQL als `service_role`. Alleen de dunne
TypeScript-wrapper valt buiten bereik, en daar zitten geen beslissingen in — een
limiettabel en een fail-open catch. Nu afgedekt door S54–S57.

Een van die tests slaagde eerst om de verkeerde reden: hij riep de functie aan
en las de tabel in één statement, dus de zojuist geschreven rij zat nog niet in
zijn snapshot. Een mutatie die het e-mailadres leesbaar opsloeg ging er dwars
doorheen. Gesplitst in twee statements, en toen beet hij wel.

**Geen penetratietest door een derde.** Het masterprompt vraagt om een
penetratietest van de tenant-isolatiegrens. Wat er ligt is 334 assertions plus
mutatietesten waarin een maatregel bewust wordt gesloopt om te zien of de test
bijt. Dat is geen vervanging voor iemand die er van buiten naar kijkt, en het
zou raar zijn om te doen alsof.

**Security headers zijn niet in productie geverifieerd.** Sinds Fase 13 draait er
wel een end-to-end suite tegen een **productiebuild** in een echte browser, die
de headers controleert én — belangrijker — bewijst dat de applicatie onder haar
eigen CSP nog hydrateert. Wat nog ontbreekt is de controle achter de
hostingpartij, met hun headers ernaast. Fase 14; zie ook D-23 over de
`Host`-header.

**`npm audit`: 0 kwetsbaarheden**, zowel met als zonder devDependencies, op
2026-08-28. Dat is een momentopname; het hoort in CI en niet in een document.
