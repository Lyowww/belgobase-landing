# BelgoBase op de website

Deze branch is een lokale kandidaat voor web-first registratie en de bestaande
BelgoBase-werkruimte. Een geslaagde lokale test is geen productiepublicatie.

## Gedeelde productbasis

De ingesloten werkruimte en het logo komen byte-identiek uit desktopfreeze
zoals vastgelegd in `src/lib/workspace/assets/release.json`; dat bestand bindt
de release-identiteit en bytes.
`tools/sync_workspace_release.py` bereidt een volgende gecontroleerde freeze
voor; dit commando publiceert zelf niets. De browseradapter vervangt uitsluitend
de desktopverbinding, microfoonopname en bestandsdownload door webfuncties.

Een gepubliceerde webversie wordt bij opnieuw openen direct geladen. Een open
werkruimte krijgt een melding en vraagt om herladen, zodat een opname of
onafgemaakte selectie niet door een update verdwijnt. Voor een volgende release
blijven frontend en servercontract gezamenlijk te controleren; een desktopbuild
alleen wijzigt de website niet vanzelf.

## Registratie en identiteit

Nieuwe professionele klanten gebruiken licentie, e-mailcode, bedrijfsgegevens
en de centraal geleverde verklaringen/documenten. Een inschrijfsessie geeft nog
geen toegang tot bedrijfsdata. De centrale administratie bepaalt profiel,
licentie en ontvangstbewijs. Bestaande desktopklanten koppelen hun bestaande
identiteit; een reeds gekoppelde licentie mag niet opnieuw worden toegewezen.

Wachtwoorden worden niet ingevoerd of bewaard. Sessiecookies blijven HttpOnly.
Iedere serveractie controleert de actuele licentie en rechten. Bestaande
apparaatlimieten blijven gelden voor Windows en browsers samen.

## Publicatievoorwaarden

1. De gegenereerde centrale server- en accountkandidaten moeten samen slagen
   tegen de werkelijke modules en schema's, plus de bestaande desktoproute.
2. Vóór plaatsing moeten de live bronhashes opnieuw overeenkomen. Ander actief
   desktopwerk kan dezelfde serverbestanden wijzigen; nooit blind overschrijven.
3. Maak één herstelkopie van geraakte code/configuratie en een consistente
   databaseback-up. Publiceer de compatibele servercode eerst met web uit.
4. Configureer beschermde VPS-sleutels, pin alleen de openbare mailsleutel en
   controleer de bestaande Resend-koppeling zonder secrets naar bron of rapport
   te kopiëren. Websitepublicatie loopt via GitHub; een aparte Vercel-login is
   daarvoor niet nodig.
5. Controleer echte mailbezorging, registratie, heraanmelding, dossier,
   zoekopdracht en Excel via de gepubliceerde site voordat klanten starten.

Herstel na nieuwe klantregistraties draait de database niet blind terug:
schakel webtoegang uit en herstel compatibele code, met behoud van klant- en
ontvangstbewijsgegevens. Voer geen klantupdater- of Storepublicatie uit als
onderdeel van deze webplaatsing.

## Bewijsgrenzen

De browserproef gebruikt synthetische gegevens en een mockbackend. Zij bewijst
de bediening en HTTP-vormen, niet actuele VPS-data of mailbezorging. Gedeelde
opgeslagen werkruimten worden tussen browsers getest met revisiecontrole.
De bestaande Windows-client is in deze branch niet gewijzigd; automatische
synchronisatie van zijn huidige lokale bestanden is daarom niet bewezen.

## Bestaande publicatieroute en onderhoudsgrens

De GitHub-repository is `Lyowww/belgobase-landing`. Een push naar een werkbranch
maakt een preview; `main` publiceert de productiewebsite. Op 18 september is
deze route opnieuw bewezen: commit `885bb1d551acc424b7a7cdbdac6b22f7b8d2b0ce`
op `codex/belgobase-webapp-20260918` kreeg van GitHub-context `Vercel` de status
`success` / `Deployment has completed`. Dit bewijst de websitebuild, niet de
echte serverregistratie of mailbezorging. Publiceer geen onvolledige loginflow
op main op basis van alleen deze buildstatus.

De VPS draait beide processen als SYSTEM via Scheduled Tasks:

- `BelgoBase Account Service 8765`, wrapper
  `C:\BelgoBase_App\account_service_build60_update8\run_account_service_task.cmd`.
- `BelgoBase API Server 8770`, wrapper
  `C:\BelgoBase_App\server\run_30b_api_task.cmd`.

Behoud alle bestaande wrapperinstellingen. De accountwrapper krijgt alleen de
gedeelde `BELGOBASE_ACCOUNT_INTERNAL_PROOF_FILE`. De API-wrapper krijgt de
webinstellingen uit `backend/runtime.py`, eerst met `BELGOBASE_WEB_ENABLED=0`.
Beide gebruiken de bestaande centrale licentiedatabase. Nieuwe secretbestanden
krijgen uitsluitend passende beheerders-/SYSTEM-toegang; rapporteer alleen
de openbare Ed25519-mailsleutel. De relay-URL is exact
`https://www.belgobase.com/api/web/mail`, zonder redirect.

Vóór een serverwijziging moet de dagelijkse NBB-taak afgerond zijn. Op de
laatste read-only controle liep de echte 31H-kandidaatbouw nog; deze taak wordt
niet gestopt. Controleer daarna opnieuw actuele bron- én wrapperhashes, maak
code/configuratieherstelkopieën en een consistente SQLite-back-up. Start eerst
de accounttaak, dan de API met web uit. Controleer bestaande desktoproutes.
Publiceer vervolgens de passende website/mailrelay via GitHub, controleer
mailbezorging en activeer pas daarna webtoegang voor de echte gebruikersproef.
Verloren tijd of een succesvolle build zijn geen vervanging voor die proef.
