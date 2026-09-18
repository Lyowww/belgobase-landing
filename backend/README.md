# BelgoBase browserauthenticatie (lokale kandidaat)

Deze package bevat het kleinste servercontract waarmee de website een
bestaande BelgoBase-licentie kan claimen en daarna met een e-mailcode kan
aanmelden. De browser krijgt geen BAT3-token, Windows-devicecredential,
machinefingerprint, licentiecodehash of serversecret.

## HTTP-contract

De Next BFF proxy't same-origin aanvragen naar deze VPS-routes:

| Methode en route | Invoer / resultaat |
|---|---|
| `POST /web/auth/claim` | `{email,license_code,remember_browser}`; generieke `202` met `challenge_id` |
| `POST /web/auth/login` | `{email,remember_browser}`; generieke `202` met `challenge_id` |
| `POST /web/auth/verify` | `{challenge_id,code}`; `authenticated`, veilig `account`, `auth_context`, `csrf`; sessie alleen in `Set-Cookie` |
| `GET /web/auth/session` | zelfde publieke sessievorm zonder nieuw cookie |
| `GET /web/auth/sessions` | actieve browserseats van deze account |
| `POST /web/auth/revoke` | `{browser_id}` plus CSRF; trekt één eigen browserseat in |
| `POST /web/auth/logout` | trekt huidige browser en sessie in |
| `POST /web/auth/logout-all` | trekt alle browsersessies van de licentie-account in |
| `POST /web/enrollment/start` | nieuwe, nog ongebonden licentie: `{license_code,email,remember_browser}`; generieke `202` |
| `POST /web/enrollment/verify` | OTP; zet uitsluitend de tijdelijke enrollmentcookie, nog geen datarechten |
| `GET /web/enrollment/session` | hervat een geverifieerde, onvoltooide inschrijving |
| `POST /web/enrollment/autofill` | centrale KBO-lookup plus actuele B2B-preflight en exacte juridische teksten |
| `GET /web/enrollment/legal/{preflight}/{document}` | gehashte brontekst uit de centrale juridische bundel |
| `POST /web/enrollment/complete` | atomaire centrale profiel+webreceiptbinding, daarna normale websessie |
| `POST /web/bridge` | `{method,payload}` plus CSRF; antwoord is exact de pywebview-vorm `{ok,...}` |

Alle POST-routes eisen een exact toegestane `Origin` en JSON. Auth-body's zijn
maximaal 16 KiB; de bridgebody maximaal 8 MiB. De productiecookie is
`__Host-belgobase_session` met `HttpOnly; Secure; SameSite=Lax; Path=/` en
zonder `Domain`. Ontwikkeling gebruikt `belgobase_session` zonder `Secure`.
De tijdelijke productiecookie is `__Host-belgobase_enrollment` met dezelfde
cookiebeperkingen en een uur geldigheid. Een verloren completion-response kan
binnen die termijn dezelfde browserseat veilig herstellen; na expiry moet de
klant opnieuw aanmelden. Privé/consumentenregistratie blijft geblokkeerd omdat
de actuele centrale set uitsluitend de professionele B2B-aanvaarding dekt.

Een concreet samenstelpunt:

```python
workspace = WorkspaceService(core_callbacks, tenant_store, assets_dir)
adapter = WebAuthHTTPAdapter(
    auth_service,
    allowed_origins={"https://www.belgobase.com"},
    production=True,
    bridge_handler=make_workspace_bridge_handler(workspace),
    bridge_scope_resolver=workspace_scope_resolver,
)
```

De registry krijgt de bestaande, aan database en pepper gebonden
`belgobase_license_registry_42a.validate_credential`. Iedere sessiecontrole
leest opnieuw status, looptijd, tenant, support-e-mail, plan en rechten uit die
centrale bron. Zie `CENTRAL_INTEGRATION.md` voor de twee noodzakelijke
device-seat wijzigingen voordat publicatie veilig is.

`tools/generate_web_runtime_candidate.py` en
`tools/generate_account_enrollment_candidate.py` genereren uitsluitend lokale,
hashgebonden kandidaten. De tweede voegt een apart webkanaal toe voor claims,
preflights en Ed25519-gesigneerde receipts; hij hergebruikt geen fictief
Windowsdevice of installerversie. Bestaande desktopreceipts blijven leesbaar en
een latere desktoppreflight ziet het via web aangemaakte profiel als `bound`.

## Mailrelay

`SignedWebsiteMailer` verstuurt canonical JSON met
`purpose=belgobase-login-v1`, e-mail, zescijferige code, challenge-id,
Unix-tijden en taal. De Ed25519-signature staat base64 in
`X-BelgoBase-Mail-Signature`. De relay controleert de signature op de exacte
body, schema, freshness en geldigheid en gebruikt
`belgobase-login/{challenge_id}` als Resend-idempotency key.

Er wordt lokaal geen echte mail verstuurd. Deze kandidaat bewijst geen VPS- of
Vercel-deployment en geen productielevering.
