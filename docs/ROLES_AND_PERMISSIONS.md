# TagPoint Taxi Dispatch — Rollen en permissies

> Status: **ontwerp (Fase 0/1)**.

---

## 1. Uitgangspunt

Er staat nergens in de codebase een controle als:

```ts
if (user.role === 'admin') { ... }   // ❌ verboden
```

Alle autorisatie loopt via permissiesleutels:

```ts
await requirePermission(orgId, 'rides.dispatch');   // ✅
```

Reden: rollen veranderen per klant, permissies niet. Een organisatie die een
eigen rol "Planner weekend" wil maken, moet dat kunnen zonder dat er een regel
code verandert.

## 2. Model

```
profiles
   └─< organization_users (lidmaatschap, per organisatie)
          └─< organization_user_roles
                 └── roles ──< role_permissions >── permissions
```

- Een gebruiker kan lid zijn van **meerdere** organisaties, met per organisatie
  andere rollen (§7).
- Een lid kan **meerdere rollen** dragen; de effectieve permissieset is de
  vereniging daarvan.
- `roles.organization_id IS NULL` = systeemrol (voor alle tenants, niet
  bewerkbaar door tenants). Niet-null = custom rol van die organisatie.
- Permissies zijn additief. Er zijn geen "deny"-regels — die maken de effectieve
  set onvoorspelbaar en zijn een bekende bron van beveiligingsfouten.

## 3. Principals buiten het RBAC-model

Niet elke gebruiker is een organisatiemedewerker. Cliënten, contactpersonen en
opdrachtgevers krijgen **geen rol** in `organization_user_roles`. Hun toegang
komt uit relatietabellen:

| Principal | Bron van toegang | Rechten |
|---|---|---|
| Cliënt | `clients.user_id` | Vaste, beperkte set (portaal) |
| Contactpersoon | `client_contacts` | Per koppeling: `can_view_rides`, `can_report_absence`, `can_request_changes` |
| Opdrachtgever | `care_organization_users` + `client_care_organizations` | Vaste, beperkte set (portaal) |
| Platformbeheerder | `platform_admins` | Platformpermissies; **geen** tenant-PII (zie `SECURITY.md` §5) |

Dit is bewust gescheiden. Zou een ouder een "rol" binnen de organisatie krijgen,
dan is één configuratiefout genoeg om hem toegang tot alle cliënten te geven.

## 4. Permissiecatalogus

`permissions.key` is stabiel en wordt nooit hernoemd — alleen toegevoegd of
gedeprecieerd.

### Organisatie
| Sleutel | Betekenis |
|---|---|
| `organization.view` | Organisatiegegevens inzien |
| `organization.manage` | Organisatiegegevens en instellingen wijzigen |
| `organization.members.view` | Ledenlijst inzien |
| `organization.members.manage` | Leden uitnodigen, schorsen, verwijderen |
| `organization.roles.view` | Rollen en permissies inzien |
| `organization.roles.manage` | Rollen aanmaken/wijzigen en toewijzen |
| `branding.manage` | Logo, kleuren, favicon, supportgegevens |
| `domain.manage` | Custom domeinen |
| `audit.view` | Auditlog inzien |

### Cliënten en relaties
| Sleutel | Betekenis |
|---|---|
| `clients.view` | Cliëntenlijst en -detail |
| `clients.create` · `clients.update` · `clients.delete` | Beheer |
| `clients.transport_notes.view` | Vervoersnotities inzien (apart recht — zie `SECURITY.md` §9) |
| `contacts.view` · `contacts.manage` | Contactpersonen en koppelingen |
| `care_organizations.view` · `care_organizations.manage` | Opdrachtgevers |
| `locations.view` · `locations.manage` | Locaties |

### Vloot
| Sleutel | Betekenis |
|---|---|
| `drivers.view` · `drivers.manage` | Chauffeurs |
| `vehicles.view` · `vehicles.manage` | Voertuigen |

### Ritten en planning
| Sleutel | Betekenis |
|---|---|
| `rides.view` | Ritten inzien |
| `rides.view.assigned` | Alleen eigen toegewezen ritten (chauffeur) |
| `rides.create` · `rides.update` · `rides.cancel` | Ritbeheer |
| `rides.assign_driver` · `rides.assign_vehicle` | Toewijzen |
| `rides.dispatch` | Dispatchscherm en statusinterventies |
| `rides.checkin` · `rides.checkout` | Cliënt in-/uitchecken |
| `rides.report_absence` | Afwezigheid registreren |
| `rides.report_problem` | Probleem melden |
| `rides.force_status` | Status buiten de state machine zetten (altijd geaudit) |
| `ride_templates.view` · `ride_templates.manage` | Terugkerende ritten |
| `planning.view` · `planning.manage` | Planningsschermen |

### Tags
| Sleutel | Betekenis |
|---|---|
| `tags.view` | Tags en hun status |
| `tags.manage` | Aanmaken, koppelen, ontkoppelen, deactiveren, vervangen |

### Overig
| Sleutel | Betekenis |
|---|---|
| `reports.view` | Rapportages |
| `change_requests.view` · `change_requests.review` | Wijzigingsverzoeken uit portalen |
| `notifications.view` | In-app notificaties |

### Platform (alleen `platform_admins`)
`platform.organizations.view` · `platform.organizations.manage` ·
`platform.settings.manage` · `platform.logs.view` · `platform.support.request`

`platform.support.request` **verleent geen inzage** — het vraagt inzage aan;
de organisatie keurt goed via `support_access_grants`.

## 5. Systeemrollen

Rechten per systeemrol. `●` = toegekend.

| Permissie(groep) | Owner | Admin | Planner | Dispatcher | Driver | Read-only |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `organization.view` | ● | ● | ● | ● | | ● |
| `organization.manage` | ● | ● | | | | |
| `organization.members.*` | ● | ● | | | | |
| `organization.roles.*` | ● | | | | | |
| `branding.manage` | ● | ● | | | | |
| `domain.manage` | ● | | | | | |
| `audit.view` | ● | ● | | | | |
| `clients.view` | ● | ● | ● | ● | | ● |
| `clients.create/update` | ● | ● | ● | | | |
| `clients.delete` | ● | ● | | | | |
| `clients.transport_notes.view` | ● | ● | ● | ● | ●¹ | |
| `contacts.*` | ● | ● | ● | | | |
| `care_organizations.*` | ● | ● | ● | | | |
| `locations.view` | ● | ● | ● | ● | ●¹ | ● |
| `locations.manage` | ● | ● | ● | | | |
| `drivers.view` | ● | ● | ● | ● | | ● |
| `drivers.manage` | ● | ● | | | | |
| `vehicles.view` | ● | ● | ● | ● | | ● |
| `vehicles.manage` | ● | ● | | | | |
| `rides.view` | ● | ● | ● | ● | | ● |
| `rides.view.assigned` | | | | | ● | |
| `rides.create/update/cancel` | ● | ● | ● | ● | | |
| `rides.assign_driver/vehicle` | ● | ● | ● | ● | | |
| `rides.dispatch` | ● | ● | | ● | | |
| `rides.checkin` | ● | ● | | ● | ● | |
| `rides.checkout` | ● | ● | | ● | ● | |
| `rides.report_absence` | ● | ● | | ● | ● | |
| `rides.report_problem` | ● | ● | ● | ● | ● | |
| `rides.force_status` | ● | ● | | ● | | |
| `ride_templates.*` | ● | ● | ● | | | |
| `planning.view` | ● | ● | ● | ● | | ● |
| `planning.manage` | ● | ● | ● | ● | | |
| `tags.view` | ● | ● | ● | ● | | |
| `tags.manage` | ● | ● | ● | | | |
| `reports.view` | ● | ● | ● | ● | | ● |
| `change_requests.view` | ● | ● | ● | ● | | ● |
| `change_requests.review` | ● | ● | ● | ● | | |
| `notifications.view` | ● | ● | ● | ● | ● | ● |

¹ **Belangrijk:** een chauffeur heeft `clients.view` **niet**. Hij heeft
`rides.view.assigned`, en RLS geeft hem daarmee alleen de cliënten die aan een
van zijn ritten hangen, binnen het datumvenster. Dat is de letterlijke eis uit
§4: *"Een chauffeur mag NOOIT zomaar alle cliënten van de organisatie kunnen
bekijken."* Hetzelfde geldt voor locaties en vervoersnotities: zichtbaar in de
context van een toegewezen rit, niet als doorzoekbare lijst.

**Owner is niet automatisch almachtig.** De owner is de enige rol met
`organization.roles.manage` en `domain.manage`; verder heeft admin dezelfde set.
Ontbrekende permissies kunnen worden toegevoegd via een custom rol — niet door
een speciaal geval in de code.

## 6. Portaalrechten (geen rollen)

### Cliëntportaal
Eigen profiel inzien · eigen komende en afgelopen ritten · wijzigingsverzoek
indienen · afmelden als de organisatie dat toestaat.
Nooit: andere cliënten, chauffeursgegevens, rechtstreekse ritwijzigingen.

### Contact-/ouderportaal
Gekoppelde cliënten waarvoor `can_view_rides` geldt · ritten en status ·
afmelden bij `can_report_absence` · wijzigingsverzoek bij `can_request_changes`.
Nooit: rechtstreeks in `rides` schrijven. Alles loopt via `change_requests`
(§32).

### Opdrachtgeverportaal
Cliënten met een **geldige** koppeling (`valid_from`/`valid_to`) · planning en
ritstatus van die cliënten · afwezigheidsoverzicht · rapportages over de eigen
cliënten. Nooit: cliënten van andere opdrachtgevers, chauffeursbeheer,
organisatie-instellingen.

## 7. Handhaving

| Laag | Wat |
|---|---|
| Database | `app.has_permission(org, key)` in RLS-policies |
| Service | `requirePermission()` als eerste regel van elke mutatie |
| UI | `usePermission()` verbergt knoppen — puur cosmetisch |

De UI-laag is nooit een beveiligingsmaatregel. Een verborgen knop houdt niemand
tegen die de Server Action rechtstreeks aanroept; de service en RLS doen dat wel.

## 8. Beschermingen tegen escalatie

1. Je kunt geen rol toewijzen met permissies die je zelf niet hebt.
2. Je kunt je eigen rollen niet wijzigen (`organization_user_id != self`).
3. Een organisatie moet minimaal één actieve owner houden — trigger blokkeert
   het verwijderen van de laatste.
4. Systeemrollen zijn niet bewerkbaar door tenants.
5. Een toegewezen rol moet een systeemrol zijn of tot dezelfde organisatie
   behoren (trigger; anders is cross-tenant rolinjectie mogelijk).
6. `platform_admins` is niet zelf-insertbaar; alleen een bestaande
   platformbeheerder kan uitbreiden, en elke wijziging wordt geaudit.
