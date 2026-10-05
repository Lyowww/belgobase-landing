import { PUBLIC_MARKETING_MEASUREMENT_ENABLED } from "@/lib/marketing-measurement-config";
import type { Locale } from "@/i18n/config";

const notices = {
  nl: {
    title: "Aanvulling: optionele website- en advertentiemeting",
    date: "5 oktober 2026 · website-aanvulling 2.0",
    paragraphs: [
      "Deze aanvulling geldt voor de openbare marketingpagina’s wanneer Google-meting is ingeschakeld. Zij vervangt voor die meting de eerdere aanvulling van 28 september 2026 en de vermelding ‘geen advertentiecookies’ in de documenten van 19 september 2026. De overige informatie, waaronder uw rechten en onze contactgegevens, blijft gelden.",
      "U kiest website-analyse en advertentiemeting afzonderlijk. Zonder uw toestemming laden we geen Google-tag en doen we geen Google-netwerkverzoek. GA4 meet na toestemming veilige paginaweergaven, betrokken tijd en een beperkt aantal scroll-, knop- en videohandelingen op openbare marketingpagina’s. Google Ads meet na afzonderlijke toestemming advertentiebezoeken en geslaagde websiteaanvragen. Deze meting is niet actief in de ingelogde werkruimte.",
      "Google ontvangt technische verzoekgegevens zoals IP-adres en browserinformatie, een marketingpagina-adres zonder zoekparameters en alleen beperkte vaste gebeurtenisnamen. Een relevante verwijzer wordt hoogstens als herkomst en host zonder zoekparameters doorgegeven. Google-klikidentificaties worden alleen voor advertentiemeting gebruikt. Bij een geslaagde aanvraag sturen we naar GA4 het gebeurtenistype generate_lead en naar Google Ads de directe conversie met een willekeurig gebeurtenisnummer. Naam, e-mailadres, telefoonnummer, formulierinhoud, vrije zoekopdrachten en werkruimtegegevens worden niet toegevoegd. Toestemming is de grondslag voor beide optionele doelen.",
      "De cookie bb_marketing_consent_v2 onthoudt beide keuzes maximaal 180 dagen. Een oude enkelvoudige advertentiekeuze wordt niet als toestemming hergebruikt. Na toestemming kan Google onder meer _ga- en _gcl_-cookies plaatsen; onze GA4-configuratie begrenst de _ga-cookie tot maximaal 180 dagen. Tijdelijke sessieopslag met de prefix bb-google-lead: voorkomt dubbele melding van dezelfde aanvraag. Google kan gegevens buiten de EER verwerken; informatie over ontvangers, bewaring en doorgifte staat in de hieronder gelinkte Google-informatie.",
      "U kunt beide doelen weigeren of één doel kiezen en de website blijven gebruiken. Via ‘Cookievoorkeuren’ op een marketingpagina kunt u uw keuze wijzigen. Bij intrekking stoppen we de tag, verwijderen we de bij ons bereikbare _ga- en _gcl_-cookies en herladen we de pagina. Dit wist niet automatisch gegevens die Google eerder met uw toestemming ontving. Voor vragen en privacyrechten: legal@belgobase.be.",
    ],
    links: ["Google: cookies en bewaartermijnen", "Google Analytics: privacy", "Google: advertentiegegevens en privacy"],
  },
  en: {
    title: "Supplement: optional website and advertising measurement",
    date: "5 October 2026 · website supplement 2.0",
    paragraphs: [
      "This supplement applies to public marketing pages when Google measurement is enabled. It replaces the measurement supplement dated 28 September 2026 and, for this measurement, the ‘no advertising cookies’ statement in the documents dated 19 September 2026. The remaining information, including your rights and our contact details, continues to apply.",
      "You choose website analytics and advertising measurement separately. We load no Google tag and make no Google network request without your consent. With consent, GA4 measures safe page views, engaged time and a limited set of scroll, button and video actions on public marketing pages. With separate consent, Google Ads measures ad visits and successfully received website enquiries. Measurement is not active in the signed-in workspace.",
      "Google receives technical request data such as IP address and browser information, a marketing page address without query parameters and only limited fixed event names. A relevant referrer is sent at most as its origin and host without query parameters. Google click identifiers are used only for advertising measurement. For a successfully received enquiry, GA4 receives the generate_lead event type and Google Ads receives the direct conversion with a random event identifier. Names, email addresses, phone numbers, form contents, free-form searches and workspace data are not added. Consent is the basis for both optional purposes.",
      "The bb_marketing_consent_v2 cookie remembers both choices for up to 180 days. An old single advertising choice is not reused as consent. After consent, Google may set cookies including _ga and _gcl_ cookies; our GA4 configuration limits the _ga cookie to no more than 180 days. Temporary session storage prefixed bb-google-lead: prevents duplicate reporting of the same enquiry. Google may process data outside the EEA; information on recipients, retention and transfers is available in the Google notices below.",
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
          {locale === "nl" ? "Google-meting uitgeschakeld" : "Google measurement disabled"}
        </h2>
        <p className="mt-4 text-base leading-7 text-muted">
          {locale === "nl"
            ? "De centrale schakelaar voor Google Analytics en Google Ads-meting staat uit. De website laadt geen Google-tag. Bereikbare meetcookies en de opgeslagen meetkeuze worden bij een nieuw bezoek verwijderd. Dit wist niet automatisch gegevens die eerder met uw toestemming zijn verzonden. Voor vragen of privacyrechten: legal@belgobase.be."
            : "The central switch for Google Analytics and Google Ads measurement is off. The website does not load a Google tag. Accessible measurement cookies and the stored choice are removed on a new visit. This does not automatically erase data previously sent with your consent. For questions or privacy rights: legal@belgobase.be."}
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
