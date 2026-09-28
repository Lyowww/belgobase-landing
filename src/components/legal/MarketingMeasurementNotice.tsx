import type { Locale } from "@/i18n/config";

const notices = {
  nl: {
    title: "Aanvulling: optionele advertentiemeting",
    date: "28 september 2026 · website-aanvulling 1.0",
    paragraphs: [
      "Deze aanvulling geldt voor de openbare marketingpagina’s zodra advertentiemeting is ingeschakeld. Zij vervangt voor die meting de vermelding ‘geen advertentiecookies’ in de onderstaande documenten van 19 september 2026. De overige informatie, waaronder uw rechten en onze contactgegevens, blijft gelden.",
      "NovaVenture Group BV (BelgoBase) gebruikt uitsluitend na uw toestemming een Google-tag om te meten of een websiteaanvraag na een advertentie wordt ontvangen. We laden deze tag niet voordat u toestemt. We gebruiken hiervoor geen gepersonaliseerde advertenties, remarketing of geavanceerde conversies met contactgegevens. In de ingelogde werkruimte is deze meting niet actief.",
      "Google ontvangt bij gebruik technische verzoekgegevens, zoals IP-adres en browserinformatie, een pagina-adres zonder vrije zoekparameters, eventuele Google-klikidentificaties en bij een geslaagde aanvraag een willekeurig gebeurtenisnummer. Naam, e-mailadres, telefoonnummer, formulierinhoud en uw werkruimtegegevens worden niet aan de conversiegebeurtenis toegevoegd. Toestemming is de grondslag voor deze optionele meting.",
      "De cookie bb_marketing_consent onthoudt uw keuze maximaal 180 dagen. Na toestemming kan Google advertentiecookies plaatsen, waaronder _gcl_-cookies (doorgaans maximaal 90 dagen). Tijdelijke sessieopslag met de prefix bb-google-ads-conversion: voorkomt dubbele melding van dezelfde aanvraag en verdwijnt bij het sluiten van de tab. Google kan gegevens verwerken buiten de EER; de toepasselijke informatie over ontvangers, bewaring en doorgifte staat in de hieronder gelinkte Google-informatie.",
      "U kunt weigeren en de website gewoon gebruiken. Via ‘Cookievoorkeuren’ op een marketingpagina kunt u uw toestemming intrekken. Dan stoppen we de tag en verwijderen we de bij ons bereikbare Google-advertentiecookies. Intrekken wist niet automatisch gegevens die Google voordien ontving. Voor vragen en uw privacyrechten kunt u terecht bij legal@belgobase.be.",
    ],
    links: ["Google: cookies en bewaartermijnen", "Google: advertentiegegevens en privacy"],
  },
  en: {
    title: "Supplement: optional advertising measurement",
    date: "28 September 2026 · website supplement 1.0",
    paragraphs: [
      "This supplement applies to public marketing pages when advertising measurement is enabled. For this measurement, it replaces the ‘no advertising cookies’ statement in the documents dated 19 September 2026 below. The other information, including your rights and our contact details, continues to apply.",
      "NovaVenture Group BV (BelgoBase) loads a Google tag only after you consent, to measure whether a website enquiry is received following an advertisement. We do not use personalised advertising, remarketing or enhanced conversions with contact details for this purpose. This measurement is not active in the signed-in workspace.",
      "Google receives technical request data such as IP address and browser information, a page address without arbitrary query parameters, any Google click identifiers and, for a successfully received enquiry, a random event identifier. Names, email addresses, phone numbers, form contents and workspace data are not added to the conversion event. Consent is the basis for this optional measurement.",
      "The bb_marketing_consent cookie remembers your choice for up to 180 days. After consent, Google may set advertising cookies including _gcl_ cookies (generally up to 90 days). Temporary session storage prefixed bb-google-ads-conversion: prevents duplicate reporting of the same enquiry and ends when the tab closes. Google may process data outside the EEA; information on recipients, retention and transfers is available in the Google notices linked below.",
      "You can reject measurement and continue using the website. Use ‘Cookie preferences’ on a marketing page to withdraw consent. We then stop the tag and remove the Google advertising cookies accessible to us. Withdrawal does not automatically erase data Google already received. Contact legal@belgobase.be with questions or privacy rights requests.",
    ],
    links: ["Google: cookies and retention", "Google: advertising data and privacy"],
  },
} as const;

export function MarketingMeasurementNotice({ locale }: { locale: Locale }) {
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
        <a href="https://business.safety.google/privacy/google-services/ads/" rel="noreferrer">{notice.links[1]}</a>
      </div>
    </article>
  );
}
