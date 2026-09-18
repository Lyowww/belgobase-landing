# Centrale integratie voor browserauthenticatie

Deze map is een lokale kandidaat. Zij wijzigt de huidige VPS, de Windows-client
of een bestaande licentiedatabase niet.

## Vereiste runtimekoppeling

Gebruik voor `WebAuthConfig.state_database` **dezelfde SQLite-database** als de
bestaande tabellen `licenses`, `license_customer_profiles` en `devices`. Roep
`schema.sql` bij start aan voordat webauthenticatie verkeer accepteert. Daarmee
delen Windows- en browseractivering één `BEGIN IMMEDIATE` transactieslot.

Maak `BelgoBaseLicenseRegistry` met de bestaande
`belgobase_license_registry_42a.validate_credential`; voeg geen tweede
licentiecodevalidator toe. De webbridge krijgt een door de server gemaakt
`AuthContext` en roept dezelfde queryfuncties aan die de huidige HTTP-routes
gebruiken. Browserdata mag `license_id`, `customer_id`, `plan`, `rights`,
`user_id` en `browser_id` nooit invullen.

## Noodzakelijke wijziging in de centrale device-registry

De actuele lokale VPS-preimage in `.local/preimage` bevestigt dat
`belgobase_device_registry_43a.py` bij nieuwe Windows-activering rond
regels 463-468 uitsluitend rijen uit `devices`. Bij het hervatten van een
geschorst device gebeurt hetzelfde rond regels 817-829. Beide tellingen moeten
binnen hun bestaande `BEGIN IMMEDIATE` transactie worden vervangen door
`backend.seat_policy.count_all_allocated(...)`:

```python
allocated = count_all_allocated(
    connection,
    license_row["license_id"],
    current_text,
)
```

Bij hervatten moet het bestaande device worden uitgesloten:

```python
allocated = count_all_allocated(
    connection,
    row["license_id"],
    current_text,
    exclude_device_id=normalized,
)
```

De vergelijking met `max_devices` blijft ongewijzigd. De helper telt
`active`/`suspended` Windows-devices plus actieve, niet-verlopen browserseats.
De webauthservice telt in dezelfde transactie eerst Windows-devices en daarna
browserseats. Zonder deze twee centrale wijzigingen kan een browser eerst een
seat reserveren en een latere Windows-activering de limiet alsnog overschrijden;
publicatie is dan fail-closed te blokkeren.

Ook `belgobase_license_registry_42a._allocated_device_count` telt nu alleen
Windows-devices. `update_license` gebruikt die helper rond regel 648 om te
beslissen of `max_devices` mag worden verlaagd. Laat die helper dezelfde
gecombineerde telling gebruiken, anders kan een beheeractie de limiet onder
het aantal actieve Windows- en browserseats verlagen.

Maak geen fictief Windows-device, BAT3-token, machinefingerprint of device key
voor de browser. Verbruikslimieten gebruiken `quota_subject_id` uit de
servercontext (`web:<browser_id>`) en de bestaande persistente limiet per
`license_id`.

De huidige `belgobase_usage_limits_46a.UsageController.start_request` leest
rond regel 366 alleen `context["device_id"]`. Wijzig dat centraal in:

```python
device_id = str(
    context.get("device_id") or context.get("quota_subject_id") or ""
)
if not device_id:
    raise UsageLimitExceeded("usage_subject_missing", status=403)
```

Zo behouden Windows-aanvragen hun bestaande device-id en krijgen browsers een
eigen rate/concurrency subject. De persistente dag- en maandtellers blijven op
de bestaande `license_id`; er ontstaat geen extra licentieruimte.

## Autorisatie en bridge

`authorization.py` volgt de actuele planplafonds en rechtenvertaling uit
`belgobase_authorization_45a`. De HTTP-adapter eist daarnaast een
`bridge_scope_resolver(method, payload)`. Die resolver moet elke toegestane
bridgemethode mappen op de bestaande operationscopes. Onbekende methoden moeten
door de resolver worden geweigerd; een lege scopeset is alleen geldig voor een
expliciet geclassificeerde accountbewerking.

Voeg aan de centrale authorisatiemodule één functie toe die een reeds door
webauth geverifieerde customercontext tegen een **bestaande canonieke route**
controleert. Zij moet `resolve_route_policy`, `effective_scopes` en
`record_authorization_decision` hergebruiken. Zij mag geen Bearer-token of
`X-BelgoBase-Device` verlangen, want de invoer is de live opnieuw gevalideerde
serversessie; zij mag evenmin plan of rights uit browser-JSON aannemen.

## Inbouw in main8770

Monteer de webadapter in het bestaande `ApiHandler`/`BoundedThreadingHTTPServer`
proces. Een sidecar die `30b...server.py` importeert, splitst workerlimieten,
thread-local deadlines, usage-concurrency en datasetlevenscyclus en is daarom
geen veilige kleinste route.

Maak de bestaande customerbranches eerst herbruikbaar als een interne
`dispatch_customer_operation(route, payload, auth_context, permit)` en laat
zowel de BAT3-routes als de webworkspace die functie gebruiken. Voor iedere
data-actie doet de webworkspace in deze volgorde:

1. valideer de opaque websessie opnieuw;
2. map de werkruimtemethode en payload naar de canonieke bestaande route;
3. authoriseer de servercontext tegen die route en schrijf dezelfde
   authorization decision;
4. start `USAGE_CONTROLLER.start_request` met de canonieke route en volledige
   webcontext, roep `permit.configure_payload` aan en sluit de permit in
   `finally`;
5. voer de bestaande dispatcher uit, inclusief `permit.complete` bij export.

Een zoekactie met XBRL-filters gebruikt `/xbrl/leadsearch/count` en
`/xbrl/leadsearch/results`; een gewone zoekactie de overeenkomstige
`/leadsearch/*` routes. Export met XBRL-filters gebruikt
`/xbrl/leadsearch/export` en vereist alle vier bestaande scopes. Daardoor
blijven routeclassificatie, rijenlimieten, deadlines en DuckDB-openingen uit
`request_duckdb_connect` centraal gelden. De huidige `WebCore` is een bruikbare
DTO-adapter, maar directe aanroepen van `run_*` zonder canonieke
permit/dispatcher zijn geen productie-integratie.

Lees de webbody begrensd vóór allocatie: 16 KiB voor auth en 8 MiB voor bridge.
Laat het bestaande serveraudit-finallypad ook bij `/web/*` lopen en zet daarvoor
de door de server geverifieerde context als auditcontext. Log geen cookie,
licentiecode, OTP of mailbody.

`user_id` hoort bij de eenmalig geclaimde licentie-account en blijft bij iedere
browserlogin gelijk; `browser_id` is per seat verschillend. De cloud
workspace-tenant is daarom stabiel op `customer_id + license_id + user_id`.
Een tweede browser deelt accountdata maar verbruikt wel een tweede bestaande
`max_devices`-seat. Een latere desktop-sync moet dezelfde tenantidentiteit via
een centraal API-contract gebruiken en mag de desktopdevicecontrole niet
omzeilen.

## Mail en secrets

De VPS genereert de zescijferige OTP. `SignedWebsiteMailer` verstuurt de exact
gesigneerde UTF-8 JSON-bytes via HTTPS naar `/api/web/mail`. De Ed25519 private
key en de webauth-HMAC-secret blijven VPS-secrets; alleen de publieke sleutel
wordt in de website gepind. Geen OTP, sessietoken, licentiecode of private key
mag worden gelogd.

Dit ontwerp bewijst lokale contractsamenhang en tests. Het bewijst geen
VPS-deployment, mailbezorging, productiedatabase-migratie of browser-run.
