# BelgoBase op de website

Deze branch is een lokale kandidaat voor web-first registratie en de bestaande
BelgoBase-werkruimte. Een geslaagde lokale test is geen productiepublicatie.

## Gedeelde productbasis

De ingesloten werkruimte en het logo komen byte-identiek uit desktopfreeze
BUILD98_UPDATE46_FINAL3. `src/lib/workspace/assets/release.json` bindt de bytes.
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
   controleer Vercel/Resend zonder secrets naar bron of rapport te kopiëren.
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
