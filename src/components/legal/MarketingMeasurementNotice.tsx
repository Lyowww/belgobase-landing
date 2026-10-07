import { PUBLIC_MARKETING_MEASUREMENT_ENABLED } from "@/lib/marketing-measurement-config";
import type { Locale } from "@/i18n/config";

const notices = {
  fr: {
    "title": "Mesure facultative du site et des publicités",
    "date": "7 octobre 2026 · inclus dans la version 1.3",
    "paragraphs": [
        "Ces informations sur les pages publiques de présentation sont incluses dans la Déclaration de confidentialité et la Déclaration relative aux cookies et au stockage du 7 octobre 2026, version 1.3. Les mêmes finalités de mesure et les mêmes choix sont résumés ci-dessous.",
        "Vous choisissez séparément l’analyse du site et la mesure publicitaire. Sans votre accord, nous ne chargeons aucune balise Google et ne faisons aucune requête réseau Google. Avec votre accord, GA4 mesure des pages vues filtrées, le temps d’engagement et un nombre limité d’actions de défilement, de boutons et de vidéos sur les pages publiques. Avec un accord distinct, Google Ads mesure les visites publicitaires et les demandes reçues par le site. Cette mesure n’est pas active dans l’espace de travail connecté.",
        "Google reçoit des données techniques telles que l’adresse IP et des informations sur le navigateur, une adresse de page sans paramètres libres et un nombre limité de noms d’événements fixes. Seulement si vous autorisez la mesure publicitaire, cette adresse peut contenir un identifiant de clic Google validé (gclid, gbraid ou wbraid) pour l’attribution publicitaire ; les autres paramètres et le fragment sont supprimés. Une référence pertinente est transmise au maximum sous forme d’origine et d’hôte sans paramètres. Pour une demande reçue, GA4 reçoit le type generate_lead et Google Ads la conversion directe avec un identifiant d’événement aléatoire. Nom, adresse e-mail, téléphone, contenu de formulaire, recherches libres et données de l’espace de travail ne sont pas ajoutés. Le consentement est la base des deux finalités facultatives.",
        "Le cookie bb_marketing_consent_v2 mémorise les deux choix pendant au maximum 180 jours. Un ancien choix publicitaire unique n’est pas réutilisé comme consentement. Après accord, Google peut placer notamment des cookies _ga et _gcl_ ; notre configuration GA4 limite le cookie _ga à 180 jours maximum après la dernière visite mesurée ; une nouvelle visite mesurée peut renouveler ce délai. Le stockage de session temporaire préfixé bb-google-lead: évite de signaler deux fois la même demande. Google peut traiter des données hors de l’EEE ; les informations sur les destinataires, la conservation et les transferts figurent dans les informations Google ci-dessous.",
        "Vous pouvez refuser les deux finalités ou en choisir une et continuer à utiliser le site. Les « Préférences de cookies » d’une page de présentation permettent de changer votre choix. En cas de retrait, nous arrêtons la balise, supprimons les cookies _ga et _gcl_ accessibles et rechargeons la page. Cela n’efface pas automatiquement les données reçues auparavant par Google avec votre accord. Pour vos questions ou droits : legal@belgobase.be."
    ],
    "links": [
        "Google : cookies et conservation",
        "Google Analytics : confidentialité",
        "Google : données publicitaires et confidentialité"
    ]
},
  nl: {
    title: "Optionele website- en advertentiemeting",
    date: "7 oktober 2026 · opgenomen in versie 1.3",
    paragraphs: [
      "Deze informatie over openbare marketingpagina’s is opgenomen in de Privacyverklaring en Cookie- en opslagverklaring van 7 oktober 2026, versie 1.3. Hieronder vindt u dezelfde meetdoelen en keuzes in een kort overzicht.",
      "U kiest website-analyse en advertentiemeting afzonderlijk. Zonder uw toestemming laden we geen Google-tag en doen we geen Google-netwerkverzoek. GA4 meet na toestemming veilige paginaweergaven, betrokken tijd en een beperkt aantal scroll-, knop- en videohandelingen op openbare marketingpagina’s. Google Ads meet na afzonderlijke toestemming advertentiebezoeken en geslaagde websiteaanvragen. Deze meting is niet actief in de ingelogde werkruimte.",
      "Google ontvangt technische verzoekgegevens zoals IP-adres en browserinformatie, een marketingpagina-adres zonder vrije zoekparameters en alleen beperkte vaste gebeurtenisnamen. Alleen wanneer u advertentiemeting toestaat, kan dit pagina-adres een gevalideerde Google-klikidentificatie (gclid, gbraid of wbraid) bevatten voor advertentieattributie; andere querygegevens en het fragment worden verwijderd. Een relevante verwijzer wordt hoogstens als herkomst en host zonder zoekparameters doorgegeven. Bij een geslaagde aanvraag sturen we naar GA4 het gebeurtenistype generate_lead en naar Google Ads de directe conversie met een willekeurig gebeurtenisnummer. Naam, e-mailadres, telefoonnummer, formulierinhoud, vrije zoekopdrachten en werkruimtegegevens worden niet toegevoegd. Toestemming is de grondslag voor beide optionele doelen.",
      "De cookie bb_marketing_consent_v2 onthoudt beide keuzes maximaal 180 dagen. Een oude enkelvoudige advertentiekeuze wordt niet als toestemming hergebruikt. Na toestemming kan Google onder meer _ga- en _gcl_-cookies plaatsen; onze GA4-configuratie begrenst de _ga-cookie tot maximaal 180 dagen na het laatste gemeten bezoek; een nieuw gemeten bezoek kan die termijn vernieuwen. Tijdelijke sessieopslag met de prefix bb-google-lead: voorkomt dubbele melding van dezelfde aanvraag. Google kan gegevens buiten de EER verwerken; informatie over ontvangers, bewaring en doorgifte staat in de hieronder gelinkte Google-informatie.",
      "U kunt beide doelen weigeren of één doel kiezen en de website blijven gebruiken. Via ‘Cookievoorkeuren’ op een marketingpagina kunt u uw keuze wijzigen. Bij intrekking stoppen we de tag, verwijderen we de bij ons bereikbare _ga- en _gcl_-cookies en herladen we de pagina. Dit wist niet automatisch gegevens die Google eerder met uw toestemming ontving. Voor vragen en privacyrechten: legal@belgobase.be.",
    ],
    links: ["Google: cookies en bewaartermijnen", "Google Analytics: privacy", "Google: advertentiegegevens en privacy"],
  },
  en: {
    title: "Optional website and advertising measurement",
    date: "7 October 2026 · included in version 1.3",
    paragraphs: [
      "This information about public marketing pages is included in the Privacy Notice and Cookie and Storage Notice dated 7 October 2026, version 1.3. The same measurement purposes and choices are summarised below.",
      "You choose website analytics and advertising measurement separately. We load no Google tag and make no Google network request without your consent. With consent, GA4 measures safe page views, engaged time and a limited set of scroll, button and video actions on public marketing pages. With separate consent, Google Ads measures ad visits and successfully received website enquiries. Measurement is not active in the signed-in workspace.",
      "Google receives technical request data such as IP address and browser information, a marketing page address without arbitrary query parameters and only limited fixed event names. Only when you allow advertising measurement may this page address include a validated Google click identifier (gclid, gbraid or wbraid) for ad attribution; all other query data and the fragment are removed. A relevant referrer is sent at most as its origin and host without query parameters. For a successfully received enquiry, GA4 receives the generate_lead event type and Google Ads receives the direct conversion with a random event identifier. Names, email addresses, phone numbers, form contents, free-form searches and workspace data are not added. Consent is the basis for both optional purposes.",
      "The bb_marketing_consent_v2 cookie remembers both choices for up to 180 days. An old single advertising choice is not reused as consent. After consent, Google may set cookies including _ga and _gcl_ cookies; our GA4 configuration limits the _ga cookie to no more than 180 days after the last measured visit; a new measured visit may renew this period. Temporary session storage prefixed bb-google-lead: prevents duplicate reporting of the same enquiry. Google may process data outside the EEA; information on recipients, retention and transfers is available in the Google notices below.",
      "You can reject both purposes or choose one and continue using the website. Use ‘Cookie preferences’ on a marketing page to change your choice. On withdrawal, we stop the tag, remove accessible _ga and _gcl_ cookies and reload the page. This does not automatically erase data Google previously received with your consent. Contact legal@belgobase.be for questions or privacy rights requests.",
    ],
    links: ["Google: cookies and retention", "Google Analytics: privacy", "Google: advertising data and privacy"],
  },
} as const;

export function MarketingMeasurementNotice({ locale }: { locale: Locale }) {
  if (!PUBLIC_MARKETING_MEASUREMENT_ENABLED) {
    return (
      <article className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-deep-navy">
          {locale === "nl" ? "Google-meting uitgeschakeld" : locale === "fr" ? "Mesure Google désactivée" : "Google measurement disabled"}
        </h2>
        <p className="mt-4 text-base leading-7 text-muted">
          {locale === "nl"
            ? "De centrale schakelaar voor Google Analytics en Google Ads-meting staat uit. De website laadt geen Google-tag. Bereikbare meetcookies en de opgeslagen meetkeuze worden bij een nieuw bezoek verwijderd. Dit wist niet automatisch gegevens die eerder met uw toestemming zijn verzonden. Voor vragen of privacyrechten: legal@belgobase.be."
            : locale === "fr" ? "Le réglage central de Google Analytics et de la mesure Google Ads est désactivé. Le site ne charge aucune balise Google. Les cookies de mesure accessibles et le choix enregistré sont supprimés lors d’une nouvelle visite. Cela n’efface pas automatiquement les données précédemment envoyées avec votre accord. Pour vos questions ou droits : legal@belgobase.be." : "The central switch for Google Analytics and Google Ads measurement is off. The website does not load a Google tag. Accessible measurement cookies and the stored choice are removed on a new visit. This does not automatically erase data previously sent with your consent. For questions or privacy rights: legal@belgobase.be."}
        </p>
      </article>
    );
  }
  const notice = notices[locale];
  return (
    <article className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-bold text-deep-navy sm:text-2xl">{notice.title}</h2>
      <p className="mt-2 text-sm text-muted">{notice.date}</p>
      {notice.paragraphs.map((paragraph) => (
        <p key={paragraph} className="mt-4 text-base leading-7 text-muted">{paragraph}</p>
      ))}
      <div className="mt-4 flex flex-col gap-3 text-primary underline underline-offset-2">
        <a href="https://policies.google.com/technologies/cookies" rel="noreferrer">{notice.links[0]}</a>
        <a href="https://support.google.com/analytics/answer/12017362" rel="noreferrer">{notice.links[1]}</a>
        <a href="https://business.safety.google/privacy/google-services/ads/" rel="noreferrer">{notice.links[2]}</a>
      </div>
    </article>
  );
}
