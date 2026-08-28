# TagPoint Taxi Dispatch — Database

> Status: **ontwerp (Fase 0/1)**. De SQL wordt in Fase 2 als Supabase migrations
> geschreven. Dit document is de bron van waarheid voor het datamodel.

---

## 1. Conventies

| Onderwerp    | Regel                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Primary keys | `uuid` met `default gen_random_uuid()` — geen oplopende integers (voorkomt enumeratie via IDOR)                       |
| Tenant-kolom | Elke organisatie-eigen tabel heeft `organization_id uuid not null references organizations(id)`                       |
| Timestamps   | `created_at`, `updated_at` als `timestamptz not null default now()`; `updated_at` via trigger                         |
| Soft delete  | `deleted_at timestamptz` op tabellen met operationele historie; RLS en views filteren dit weg                         |
| Enums        | PostgreSQL `enum`-types voor gesloten waardesets, `text` + check-constraint waar uitbreidbaarheid telt                |
| Naamgeving   | `snake_case`, tabellen meervoud, koppeltabellen `a_b`                                                                 |
| Cascades     | `on delete restrict` als standaard; `cascade` alleen bij echte eigendomsrelaties (settings, branding, koppeltabellen) |
| Geld/afstand | Nog niet van toepassing (geen facturatie in V1)                                                                       |

**Waarom `restrict` als default:** een cliënt verwijderen mag niet stilzwijgend
duizenden ritten en ride-events wissen. Verwijderen van personen loopt via het
GDPR-erasurepad (§8 hieronder), niet via `ON DELETE CASCADE`.

## 2. ER-overzicht

```
                          ┌──────────────────┐
                          │  organizations   │
                          └────────┬─────────┘
        ┌──────────────┬───────────┼────────────┬──────────────┐
        │              │           │            │              │
 organization_   organization_  organization_  subscriptions  (alle
   settings        branding       domains                      tenant-
                                                               tabellen)

  profiles ──< organization_users ──< organization_user_roles >── roles
     │                                                            │
     │                                              role_permissions
     │                                                            │
     │                                                      permissions
     │
     ├──< platform_admins
     ├──< drivers.user_id            (chauffeur ↔ account)
     ├──< contacts.user_id           (ouder/contact ↔ account)
     └──< care_organization_users    (opdrachtgever ↔ account)

  clients ──< client_contacts >── contacts
     │
     ├──< client_care_organizations >── care_organizations
     ├──< nfc_tags            (0..1 actieve tag)
     ├──< tag_assignments     (historie)
     ├──< ride_templates
     └──< rides

  locations ──< ride_templates.pickup/destination
            └─< rides.pickup/destination

  drivers ──< driver_vehicles >── vehicles
     └──< rides.driver_id            vehicles ──< rides.vehicle_id

  ride_templates ──< rides ──< ride_events        (append-only)
                       └──< change_requests

  audit_logs      notifications      usage_metrics       (cross-cutting)
```

## 3. Tenancy en platform

### `organizations`

| Kolom                                  | Type                  | Opmerking                                              |
| -------------------------------------- | --------------------- | ------------------------------------------------------ |
| `id`                                   | uuid pk               |                                                        |
| `slug`                                 | citext unique         | URL-veilig, `/platform/orgs/<slug>`                    |
| `name`                                 | text not null         | handelsnaam                                            |
| `legal_name`                           | text                  |                                                        |
| `status`                               | enum `org_status`     | `TRIAL` \| `ACTIVE` \| `SUSPENDED` \| `CANCELLED`      |
| `is_demo`                              | boolean default false | demo-organisatie (§56); nooit gekoppeld aan echte data |
| `created_at`/`updated_at`/`deleted_at` | timestamptz           |                                                        |

Een `SUSPENDED` organisatie wordt in RLS behandeld als niet-leesbaar voor
niet-eigenaren — deactiveren moet daadwerkelijk toegang stoppen, niet alleen een
badge tonen.

### `organization_settings` (1:1)

`organization_id` pk/fk · `timezone` (default `Europe/Amsterdam`) · `locale`
(default `nl-NL`) · `checkin_required` bool · `checkout_mode` enum
(`DISABLED`\|`OPTIONAL`\|`REQUIRED`) · `gps_capture_enabled` bool ·
`ride_generation_horizon_days` int default 60 (check 1..180) ·
`allow_contact_absence_reporting` bool · `absence_cutoff_minutes` int

### `organization_branding` (1:1)

`display_name` · `logo_url` · `favicon_url` · `primary_color` · `secondary_color`
· `support_email` · `support_phone` · `hide_platform_branding` bool

Kleuren: `text` met check op `^#[0-9a-fA-F]{6}$`. Geen vrije CSS — dat zou een
CSS-injectievector zijn in een white-label product.

### `organization_domains`

`hostname citext unique not null` · `is_primary` bool · `verification_token` ·
`verification_status` enum (`PENDING`\|`VERIFIED`\|`FAILED`) · `verified_at`

Unique index `(organization_id) where is_primary` — maximaal één primair domein.

### `plans`, `subscriptions`, `usage_metrics`

Skelet voor §36. `plans.limits jsonb` (bijv. `{"drivers":25,"clients":500}`),
`subscriptions(organization_id, plan_id, status, trial_ends_at, current_period_*)`,
`usage_metrics(organization_id, metric_key, period_start, value)`.
**Geen betaalfunctionaliteit.** Limieten worden nog niet afgedwongen; het schema
staat er zodat dat later geen migratie van bestaande data vereist.

### `platform_admins`

`user_id pk/fk → profiles` · `granted_by` · `granted_at` · `note`

Bewust een aparte tabel in plaats van een `is_platform_admin`-vlag op `profiles`:
zo kan RLS het insert-recht volledig blokkeren voor iedereen behalve een bestaande
platformbeheerder, en is elke wijziging auditbaar.

### `support_access_grants`

`organization_id` · `granted_to_user_id` · `granted_by_user_id` · `reason` ·
`expires_at` · `revoked_at`

Dit is het mechanisme uit §57: platformbeheerders krijgen **niet** automatisch
inzage in tenant-persoonsgegevens. Zie `SECURITY.md` §5 en `RISKS_AND_DECISIONS.md` D-02.

## 4. Identiteit en RBAC

### `profiles`

`id uuid pk references auth.users(id) on delete cascade` · `email citext` ·
`full_name` · `phone` · `avatar_url` · `locale` · `status` · timestamps

Bevat **geen** organisatie- of rolinformatie: een account bestaat los van
lidmaatschap (§7).

### `organization_users`

`id` · `organization_id` · `user_id` · `status` enum (`INVITED`\|`ACTIVE`\|`SUSPENDED`)
· `invited_by` · `invited_at` · `joined_at` · timestamps
`unique (organization_id, user_id)`

### `roles`

`id` · `organization_id uuid null` · `key text not null` · `name` ·
`description` · `is_system boolean`
`unique nulls not distinct (organization_id, key)`

`organization_id IS NULL` = systeemsjabloon (owner, admin, planner, driver, …).
Een organisatie kan later een eigen rol met dezelfde `key` niet aanmaken; custom
rollen krijgen een eigen key. Systeemrollen zijn niet bewerkbaar door tenants.

### `permissions`

`key text pk` · `category` · `description` · `is_assignable boolean`
Statische referentiedata, geladen door een migration — niet per tenant.

### `role_permissions`

`(role_id, permission_key)` pk

### `organization_user_roles`

`(organization_user_id, role_id)` pk — een lid kan meerdere rollen dragen.
Check-constraint via trigger: de rol moet een systeemrol zijn óf tot dezelfde
organisatie behoren. Zonder die check kan organisatie A een rol van organisatie B
toewijzen — een privilege-escalatiepad.

## 5. Cliënten, contacten, opdrachtgevers

### `clients`

| Kolom                                             | Type                        | Opmerking                           |
| ------------------------------------------------- | --------------------------- | ----------------------------------- |
| `id`, `organization_id`                           | uuid                        |                                     |
| `first_name`, `last_name`                         | text not null               |                                     |
| `phone`, `email`                                  | text                        | optioneel                           |
| `address_line1`, `postal_code`, `city`, `country` | text                        |                                     |
| `home_location_id`                                | uuid → locations            | thuisadres als herbruikbare locatie |
| `external_reference`                              | text                        | klantnummer bij de opdrachtgever    |
| `status`                                          | enum (`ACTIVE`\|`INACTIVE`) |                                     |
| `user_id`                                         | uuid → profiles, nullable   | cliëntportaal-account               |
| timestamps + `deleted_at`                         |                             |                                     |

`unique (organization_id, external_reference) where external_reference is not null`

> **Besluit D-03 (2026-08-28): de `clients`-tabel bevat géén vervoersbehoeften.**
> Geen `transport_requirements`, geen `transport_notes`, geen vrij notitieveld.
> De cliëntrij bevat uitsluitend identificatie- en contactgegevens.
> Rolstoel- en begeleidingsbehoefte staat op de **rit** (`rides`), niet op de
> persoon. Zie §7 en `RISKS_AND_DECISIONS.md` D-03.
>
> Gevolg voor de UI: het cliëntformulier heeft geen veld waar een planner
> "gebruikt rolstoel" of een medische opmerking kwijt kan. Dat is opzet, niet
> een omissie — het formulier mag zo'n veld ook later niet terugkrijgen zonder
> dit besluit te herzien.

### `contacts`

`id` · `organization_id` · `first_name`, `last_name` · `phone`, `email` ·
`user_id` nullable → profiles · `status` · timestamps

### `client_contacts` (M2M met rechten per koppeling)

`(client_id, contact_id)` pk · `relationship` (text, bijv. moeder/vader/voogd) ·
`is_primary` bool · `can_view_rides` bool · `can_report_absence` bool ·
`can_request_changes` bool

**Rechten staan op de koppeling, niet op de contactpersoon.** Een ouder mag
afmelden voor kind A maar misschien niet voor kind B. Dit maakt de RLS-policy
voor het contactportaal exact en zonder uitzonderingen.

### `care_organizations`

`id` · `organization_id` · `name` · `contact_email`, `phone` · adresvelden ·
`external_reference` · `status` · timestamps

### `care_organization_users`

`id` · `care_organization_id` · `user_id` · `status` — portaaltoegang (§33).

### `client_care_organizations` (M2M met geldigheid)

`(client_id, care_organization_id)` · `valid_from date not null` ·
`valid_to date null`

Met geldigheidsperiode, zodat een opdrachtgever die een cliënt niet meer
financiert automatisch de toegang tot nieuwe ritten verliest — zonder dat de
historie verdwijnt.

## 6. Vloot en locaties

### `drivers`

`id` · `organization_id` · `user_id` nullable → profiles · `employee_number` ·
`first_name`, `last_name` · `phone`, `email` · `status` enum
(`ACTIVE`\|`INACTIVE`\|`ON_LEAVE`) · timestamps + `deleted_at`
`unique (organization_id, employee_number)` · `unique (organization_id, user_id)`

`user_id` is nullable: een chauffeur kan als planningsobject bestaan voordat er
een account is uitgenodigd.

### `vehicles`

`id` · `organization_id` · `license_plate` · `make`, `model` · `vehicle_type`
enum · `seats` int check ≥ 0 · `wheelchair_positions` int check ≥ 0 ·
`is_wheelchair_accessible` bool · `status` · timestamps + `deleted_at`
`unique (organization_id, upper(license_plate))`

### `driver_vehicles`

`(driver_id, vehicle_id)` pk · `is_default` bool

### `locations`

`id` · `organization_id` · `name` · `kind` enum (`HOME`, `SCHOOL`, `DAY_CARE`,
`CARE_FACILITY`, `WORK`, `STATION`, `HOSPITAL`, `OTHER`) · `address_line1` ·
`postal_code`, `city`, `country` · `latitude numeric(9,6)`,
`longitude numeric(9,6)` · `geocode_status` enum · `geocode_provider` text ·
`provider_place_ref` text · `access_notes` · `status` · timestamps

Geen PostGIS in V1 — we hebben nog geen ruimtelijke queries. `latitude`/
`longitude` als numeric is voldoende voor "open in navigatie". De
mappingprovider zit achter een interface in `lib/`, niet in het schema (§13).

## 7. Ritten

### `ride_templates` (terugkerende ritten)

| Kolom                                           | Type                                     | Opmerking                                    |
| ----------------------------------------------- | ---------------------------------------- | -------------------------------------------- |
| `id`, `organization_id`, `client_id`            | uuid                                     |                                              |
| `name`                                          | text                                     | bijv. "Heenrit dagbesteding"                 |
| `pickup_location_id`, `destination_location_id` | uuid → locations                         | check: niet gelijk                           |
| `departure_time`                                | time not null                            | **lokale tijd** (zie ARCHITECTURE §8)        |
| `days_of_week`                                  | smallint[] not null                      | ISO 1=ma … 7=zo; check op bereik + niet leeg |
| `starts_on`                                     | date not null                            |                                              |
| `ends_on`                                       | date null                                | check `ends_on >= starts_on`                 |
| `default_driver_id`, `default_vehicle_id`       | uuid null                                |                                              |
| `transport_requirements`                        | `transport_requirement[]` default `'{}'` | Zie D-03a hieronder — **nog te bevestigen**  |
| `status`                                        | enum (`ACTIVE`\|`PAUSED`\|`ARCHIVED`)    |                                              |
| timestamps                                      |                                          |                                              |

> **Openstaand: D-03a — erft een gegenereerde rit de vervoersbehoefte?**
> Besluit D-03 legt de vervoersbehoefte op de rit, niet op de cliënt. Bij
> terugkerende ritten levert dat een praktisch probleem op: een cliënt met
> twee ritten per werkdag genereert ruim 500 ritten per jaar. Zonder overerving
> moet een planner bij elk daarvan opnieuw "rolstoel" aanvinken — onwerkbaar, en
> in de praktijk gaat dat fout, met een verkeerd voertuig als gevolg.
>
> Voorstel: het veld staat óók op de template en wordt bij generatie
> gekopieerd naar de rit; de planner kan het per rit overschrijven.
> **Eerlijke kanttekening:** een template hangt aan één cliënt, dus "template van
> Jan bevat WHEELCHAIR" is in de praktijk nog steeds herleidbaar tot "Jan gebruikt
> een rolstoel". De privacywinst ten opzichte van opslag op de cliënt is dus
> reëel maar bescheiden: het gegeven is niet doorzoekbaar of filterbaar op
> persoonsniveau, staat niet in de cliëntexport, en verdwijnt zodra de template
> wordt gearchiveerd. Zie `RISKS_AND_DECISIONS.md` D-03a.
> | Kolom | Type | Opmerking |
> |---|---|---|
> | `id`, `organization_id`, `client_id` | uuid | |
> | `ride_template_id` | uuid null → ride_templates | `on delete set null` — historie blijft |
> | `scheduled_date` | date not null | |
> | `scheduled_pickup_time` | time not null | lokale wandkloktijd, gezaghebbend |
> | `scheduled_pickup_at` | timestamptz not null | afgeleid, voor sorteren/filteren |
> | `pickup_location_id`, `destination_location_id` | uuid not null | |
> | `driver_id`, `vehicle_id` | uuid null | |
> | `status` | enum `ride_status` | zie §7.1 |
> | `source` | enum (`TEMPLATE`\|`MANUAL`) | |
> | `is_modified` | boolean default false | uitzondering — generatie raakt deze rij nooit aan |
> | `transport_requirements` | `transport_requirement[]` default `'{}'` | Vervoersbehoefte **van deze rit** (D-03): `WHEELCHAIR`, `WALKER`, `ASSISTANCE_TO_DOOR`, `SEATBELT_SUPPORT`, `COMPANION_SEAT`. Gesloten enum — geen vrij tekstveld |
> | `absence_reason` | enum null | `NOT_HOME`\|`CANCELLED_BY_CLIENT`\|`ILL`\|`NO_ACCESS`\|`OTHER` |
> | `cancellation_reason` | text null | |
> | `notes` | text null | |
> | `checked_in_at`, `started_at`, `arrived_at`, `completed_at` | timestamptz null | denormalisatie voor rapportage; altijd geschreven samen met het event |
> | `created_by` | uuid null | |
> | timestamps | | |

**Duplicaatpreventie (§14):**

```sql
create unique index rides_template_date_uniq
  on rides (ride_template_id, scheduled_date)
  where ride_template_id is not null;
```

Op databaseniveau — twee gelijktijdige generatiejobs mogen niet allebei slagen.

Indexes: `(organization_id, scheduled_date)`, `(organization_id, status, scheduled_date)`,
`(driver_id, scheduled_date)`, `(client_id, scheduled_date desc)`.

#### 7.1 `ride_status` en de state machine

```
SCHEDULED ─→ DRIVER_ASSIGNED ─→ DRIVER_EN_ROUTE ─→ DRIVER_ARRIVED
                                                        │
                                    ┌───────────────────┴────────────┐
                            CLIENT_CHECKED_IN                  CLIENT_ABSENT ●
                                    │
                              TRIP_STARTED ─→ ARRIVED ─→ COMPLETED ●

Vanuit elke actieve status: → PROBLEM (herstelbaar) en → CANCELLED ●
● = eindstatus
```

- `CLIENT_ABSENT`, `CANCELLED`, `COMPLETED` zijn eindstatussen.
- `PROBLEM` is herstelbaar: terug naar de vorige status of door naar
  `CANCELLED`/`COMPLETED` door iemand met `rides.dispatch`.
- `ARRIVED → COMPLETED` is geblokkeerd als `checkout_mode = REQUIRED` en er geen
  `CLIENT_CHECKED_OUT`-event is.
- Check-out is een **event**, geen status — daarmee blijft de statuslijst
  precies zoals in §17 gespecificeerd en blijft check-out optioneel per organisatie.
- De toegestane overgangen staan in `features/rides/state-machine.ts` én worden
  door een databasetrigger gecontroleerd. Alleen `rides.force_status` mag
  daarbuiten (voor dispatchers die een vastgelopen rit rechttrekken); dat wordt
  altijd geaudit.

### `ride_events` — append-only (§18)

`id` · `organization_id` · `ride_id` · `event_type` enum · `occurred_at
timestamptz not null` · `recorded_at timestamptz default now()` ·
`actor_user_id` null · `actor_kind` enum (`DRIVER`\|`PLANNER`\|`SYSTEM`\|`PORTAL`) ·
`source` enum (`NFC`\|`QR`\|`MANUAL`\|`SYSTEM`) · `nfc_tag_id` null ·
`latitude`, `longitude`, `accuracy_m` null · `metadata jsonb default '{}'`

`occurred_at` en `recorded_at` zijn gescheiden omdat de chauffeurs-PWA offline
kan zijn: de gebeurtenis vond om 08:27 plaats, de server ontving hem om 08:41.
Zonder dat onderscheid is de audit trail onbetrouwbaar.

**Append-only afdwingen — drie lagen:**

1. Geen `UPDATE`- of `DELETE`-policy in RLS.
2. `revoke update, delete on ride_events from authenticated, anon;`
3. Een `before update or delete`-trigger die onvoorwaardelijk `raise exception`.

**Idempotentie (§60):**

```sql
create unique index ride_events_once_per_ride
  on ride_events (ride_id, event_type)
  where event_type in ('CLIENT_CHECKED_IN','CLIENT_CHECKED_OUT',
                       'TRIP_STARTED','ARRIVED','COMPLETED');
```

Een tweede scan van dezelfde tag raakt deze index en levert
"Jan is al ingecheckt om 08:27" op in plaats van een dubbel event.

### `change_requests` (§32)

`id` · `organization_id` · `client_id` · `ride_id` null · `requested_by_user_id` ·
`requester_kind` enum (`CLIENT`\|`CONTACT`\|`CARE_ORG`) · `kind` enum
(`ABSENCE`\|`TIME_CHANGE`\|`DESTINATION_CHANGE`\|`CANCEL`\|`OTHER`) ·
`payload jsonb` · `status` enum (`PENDING`\|`APPROVED`\|`REJECTED`\|`APPLIED`) ·
`reviewed_by`, `reviewed_at`, `review_note` · timestamps

Dit is het antwoord op "een ouder mag NIET direct willekeurige ritten wijzigen".
Portalen schrijven nooit rechtstreeks in `rides`; ze maken een verzoek dat een
planner beoordeelt. Afmelden kán direct doorwerken als de organisatie dat
toestaat (`allow_contact_absence_reporting`) — dan maakt de service zowel het
verzoek als het ride-event, zodat de herkomst traceerbaar blijft.

## 8. NFC / QR

### `nfc_tags`

`id` · `organization_id` · `public_code citext not null` (bijv. `TP-TAXI-8F3A21`,
voor mensen en inventaris) · `token_hash bytea not null unique` (SHA-256 van het
URL-token; het token zelf staat **niet** in de database) · `client_id` null ·
`status` enum (`UNASSIGNED`\|`ACTIVE`\|`INACTIVE`\|`LOST`\|`REPLACED`) ·
`label` · `replaced_by_tag_id` null · `activated_at` · timestamps
`unique (organization_id, public_code)`

`unique (client_id) where status = 'ACTIVE'` — één actieve tag per cliënt.

**Geen aparte `qr_codes`-tabel.** §39 noemt die, maar §21 eist dat NFC en QR
niet twee systemen worden. Een QR-code is een _weergave_ van hetzelfde token in
dezelfde URL. Een tweede tabel zou twee waarheden, twee intrekpaden en twee
beveiligingsmodellen betekenen. Zie `RISKS_AND_DECISIONS.md` D-05.

### `tag_assignments`

`id` · `organization_id` · `nfc_tag_id` · `client_id` · `assigned_at` ·
`assigned_by` · `unassigned_at` · `unassigned_by` · `reason`
Volledige koppelhistorie voor de auditvraag "wie hing wanneer welke tag aan wie".

## 9. Cross-cutting

### `audit_logs` (§37)

`id` · `organization_id` null (platformacties hebben er geen) · `actor_user_id`
null · `actor_kind` enum · `action text` (bijv. `client.updated`) ·
`entity_type`, `entity_id` · `metadata jsonb` · `ip inet` null ·
`user_agent` null · `created_at`

Zelfde append-only handhaving als `ride_events`: geen update/delete-policy,
privileges ingetrokken, trigger als vangnet. `metadata` bevat gewijzigde
veld*namen*, niet de oude en nieuwe persoonsgegevens.

### `notifications` (§62)

`id` · `organization_id` · `recipient_user_id` · `channel` enum (`IN_APP` nu;
`EMAIL`, `PUSH` gereserveerd) · `kind` · `title`, `body` · `entity_type`,
`entity_id` · `read_at` · `created_at`

## 10. Verwijderen en GDPR

Drie verschillende dingen die vaak door elkaar lopen:

| Handeling    | Mechanisme            | Effect                                            |
| ------------ | --------------------- | ------------------------------------------------- |
| Deactiveren  | `status = 'INACTIVE'` | Blijft zichtbaar in historie, niet meer planbaar  |
| Soft delete  | `deleted_at`          | Uit alle lijsten, herstelbaar, referenties intact |
| GDPR-erasure | Erasurepad            | Persoonsgegevens gewist, ritstatistiek behouden   |

Het erasurepad (Fase 12) anonimiseert in plaats van te verwijderen: de
`clients`-rij blijft bestaan met gewiste persoonsvelden en
`anonymized_at is not null`. Zo blijven ritten en events — de wettelijk
relevante vervoersadministratie — intact terwijl de persoon niet meer
identificeerbaar is. `ON DELETE CASCADE` op personen zou de auditbaarheid
vernietigen en is daarom overal vermeden.

## 11. Migrations

- Alles in `supabase/migrations/`, oplopend genummerd, forward-only.
- Elke migration is idempotent te draaien op een lege database (`supabase db reset`
  in CI moet slagen).
- Volgorde in Fase 2: extensies → enums → `app`-schema en helperfuncties →
  tabellen → indexes → triggers → RLS enable → policies → grants → seed van
  `permissions` en systeemrollen.
- RLS wordt aangezet in dezelfde migration als de tabel. Een tabel mag nooit
  bestaan zonder `enable row level security` — dat is de meest voorkomende
  manier waarop tenant-isolatie stilletjes lekt.
